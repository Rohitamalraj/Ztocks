Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT    = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$CIRDIR  = Join-Path $ROOT "circuits"
$BUILD   = Join-Path $CIRDIR "build"
$CIRCUIT = "tier_proof"
$PTAU_PP = Join-Path $BUILD "pot15_pp.ptau"

Write-Host "`n=== zkSynth ZK Circuit Setup ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $BUILD | Out-Null

# Step 0: circomlib
Write-Host "`n[0/7] Installing circomlib..." -ForegroundColor Yellow
Set-Location $CIRDIR
npm install --silent

# Step 1: Determine circom v2 binary path
Write-Host "[1/7] Checking circom v2 compiler..." -ForegroundColor Yellow
$CIRCOM_BIN = Join-Path $BUILD "circom2.exe"
if (Test-Path $CIRCOM_BIN) {
    Write-Host "  Using cached circom2.exe" -ForegroundColor Green
} else {
    $sysOk = $false
    $sys = Get-Command circom -ErrorAction SilentlyContinue
    if ($sys) {
        $ver = (& circom --version 2>&1) -join ""
        if ($ver -match "circom compiler 2\.") {
            $CIRCOM_BIN = $sys.Source
            $sysOk = $true
            Write-Host "  System circom v2: $ver" -ForegroundColor Green
        }
    }
    if (-not $sysOk) {
        Write-Host "  Downloading circom v2.1.9..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://github.com/iden3/circom/releases/download/v2.1.9/circom-windows-amd64.exe" -OutFile $CIRCOM_BIN
        Write-Host "  Downloaded: $CIRCOM_BIN" -ForegroundColor Green
    }
}
Write-Host "  Circom binary: $CIRCOM_BIN" -ForegroundColor Gray

# Step 2: snarkjs
Write-Host "[2/7] Checking snarkjs..." -ForegroundColor Yellow
if (-not (Get-Command snarkjs -ErrorAction SilentlyContinue)) {
    npm install -g snarkjs
}
Write-Host "  snarkjs OK" -ForegroundColor Green

# Step 3: Compile circuit using the resolved binary path
Write-Host "[3/7] Compiling $CIRCUIT.circom..." -ForegroundColor Yellow
Set-Location $CIRDIR
& $CIRCOM_BIN "$CIRCUIT.circom" --r1cs --wasm --sym --output $BUILD
if ($LASTEXITCODE -ne 0) { throw "circom compilation failed (exit $LASTEXITCODE)" }
Write-Host "  Compiled OK" -ForegroundColor Green

# Step 4: Powers of Tau
Write-Host "[4/7] Preparing Powers of Tau..." -ForegroundColor Yellow
if (Test-Path $PTAU_PP) {
    Write-Host "  Using cached $PTAU_PP" -ForegroundColor Green
} else {
    $PTAU_RAW = Join-Path $BUILD "pot15_raw.ptau"
    $PTAU_C1  = Join-Path $BUILD "pot15_c1.ptau"
    $downloaded = $false
    foreach ($url in @("https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau",
                        "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau")) {
        try {
            Write-Host "  Trying $url ..." -ForegroundColor Gray
            Invoke-WebRequest -Uri $url -OutFile $PTAU_PP -ErrorAction Stop
            $downloaded = $true
            Write-Host "  Downloaded" -ForegroundColor Green
            break
        } catch { Write-Host "  Failed: $_" -ForegroundColor Gray }
    }
    if (-not $downloaded) {
        Write-Host "  Generating local PoT (demo-only)..." -ForegroundColor Yellow
        & snarkjs powersoftau new bn128 15 $PTAU_RAW -v
        & snarkjs powersoftau contribute $PTAU_RAW $PTAU_C1 --name="zkSynth" -e="zkSynth$(Get-Random)" -v
        & snarkjs powersoftau prepare phase2 $PTAU_C1 $PTAU_PP -v
        Write-Host "  Local PoT ready" -ForegroundColor Green
    }
}

# Step 5: Groth16 Phase 2 setup
Write-Host "[5/7] Running Groth16 setup..." -ForegroundColor Yellow
$R1CS      = Join-Path $BUILD ($CIRCUIT + ".r1cs")
$ZKEY0     = Join-Path $BUILD ($CIRCUIT + "_0000.zkey")
$ZKEYFINAL = Join-Path $BUILD ($CIRCUIT + "_final.zkey")
$VKEYFILE  = Join-Path $BUILD "verification_key.json"

& snarkjs groth16 setup $R1CS $PTAU_PP $ZKEY0
if ($LASTEXITCODE -ne 0) { throw "groth16 setup failed" }
& snarkjs zkey contribute $ZKEY0 $ZKEYFINAL --name="zkSynth" -e="zkSynth$(Get-Random)"
if ($LASTEXITCODE -ne 0) { throw "zkey contribute failed" }
& snarkjs zkey export verificationkey $ZKEYFINAL $VKEYFILE
if ($LASTEXITCODE -ne 0) { throw "verificationkey export failed" }
Write-Host "  Setup complete" -ForegroundColor Green

# Step 6: Export Solidity verifier
Write-Host "[6/7] Generating Groth16Verifier.sol..." -ForegroundColor Yellow
$SOL_OUT = Join-Path $ROOT "contracts\src\Groth16Verifier.sol"
& snarkjs zkey export solidityverifier $ZKEYFINAL $SOL_OUT
if ($LASTEXITCODE -ne 0) { throw "solidityverifier export failed" }
Write-Host "  Written: $SOL_OUT" -ForegroundColor Green

# Step 7: Copy wasm + zkey to frontend/public/circuits/
Write-Host "[7/7] Copying artifacts to frontend..." -ForegroundColor Yellow
$PUBDIR = Join-Path $ROOT "frontend\public\circuits"
New-Item -ItemType Directory -Force -Path $PUBDIR | Out-Null
$WASM = Join-Path $BUILD ($CIRCUIT + "_js\" + $CIRCUIT + ".wasm")
Copy-Item $WASM      (Join-Path $PUBDIR ($CIRCUIT + ".wasm"))            -Force
Copy-Item $ZKEYFINAL (Join-Path $PUBDIR ($CIRCUIT + ".zkey"))            -Force
Copy-Item $VKEYFILE  (Join-Path $PUBDIR "verification_key.json")         -Force
Write-Host "  Done -- artifacts in $PUBDIR" -ForegroundColor Green

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Next: cd contracts && npx ts-node scripts/gen-oracle-key.ts" -ForegroundColor White

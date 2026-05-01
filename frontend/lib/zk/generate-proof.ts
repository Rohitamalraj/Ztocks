export interface OracleCredential {
  address: string;
  tier: number;
  creditScore: number;
  expiry: string;
  nonce: string;
  sigR8x: string;
  sigR8y: string;
  sigS: string;
  pubKeyAx: string;
  pubKeyAy: string;
}

export async function generateProof(
  cred: OracleCredential,
  onStage?: (stage: string, details?: Record<string, unknown>) => void
) {
  onStage?.("proof-load-deps-start");
    console.log("[Ztocks:proof] Loading snarkjs + circomlibjs...");

  const snarkjsModule = await import("snarkjs");
  const snarkjs = (snarkjsModule as any).default ?? snarkjsModule;

  const { buildPoseidon } = await import("circomlibjs");
  onStage?.("proof-load-deps-complete");

  const poseidon = await buildPoseidon();
  onStage?.("proof-poseidon-ready");

  const walletAddrBI = BigInt(cred.address);
  const tierBI = BigInt(cred.tier);

  const creditScoreNum = Number(cred.creditScore);
  if (!Number.isInteger(creditScoreNum) || creditScoreNum < 0 || creditScoreNum > 100) {
    throw new Error(
      "Oracle credential missing valid credit score (expected integer 0-100). Please retry verification."
    );
  }
  const creditScoreBI = BigInt(creditScoreNum);

  const expiryBI = BigInt(cred.expiry);
  const nonceBI = BigInt(cred.nonce);

  // Compute nullifier = Poseidon(nonce, walletAddr) — must match circuit
  const nullRaw = (poseidon as any)([nonceBI, walletAddrBI]);
  const nullifier = (poseidon as any).F.toObject(nullRaw) as bigint;
  onStage?.("proof-nullifier-computed", { nullifier: nullifier.toString() });

  const input = {
    // Private
    walletAddr: walletAddrBI.toString(),
    tier: tierBI.toString(),
    creditScore: creditScoreBI.toString(),
    expiry: expiryBI.toString(),
    nonce: nonceBI.toString(),
    sigR8x: cred.sigR8x,
    sigR8y: cred.sigR8y,
    sigS: cred.sigS,

    // Public
    nullifier: nullifier.toString(),
    tierPub: tierBI.toString(),
    expiryPub: expiryBI.toString(),
    walletAddrPub: walletAddrBI.toString(),
    Ax: cred.pubKeyAx,
    Ay: cred.pubKeyAy,
  };

    console.log("[Ztocks:proof] Circuit inputs:", {
    ...input,
    sigR8x: "<hidden>",
    sigR8y: "<hidden>",
    sigS: "<hidden>",
  });
    console.log("[Ztocks:proof] Running groth16.fullProve — loading .wasm + .zkey...");

  const fullProveStartedAt = Date.now();
  onStage?.("proof-fullprove-start", {
    wasm: "/circuits/tier_proof.wasm",
    zkey: "/circuits/tier_proof.zkey",
  });

  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
    input,
    "/circuits/tier_proof.wasm",
    "/circuits/tier_proof.zkey"
  );

  onStage?.("proof-fullprove-complete", {
    durationMs: Date.now() - fullProveStartedAt,
    publicSignalsCount: publicSignals.length,
  });

    console.log("[Ztocks:proof] ✓ Proof object:", proof);
    console.log("[Ztocks:proof] ✓ Public signals:", publicSignals);

  // Convert to Solidity calldata (hex strings) then to bigint (required by wagmi ABI types)
  const calldata = await (snarkjs as any).groth16.exportSolidityCallData(proof, publicSignals);
  const parsed = JSON.parse(`[${calldata}]`) as [string[], string[][], string[], string[]];
  onStage?.("proof-calldata-exported");

  const toBigInt2 = (arr: string[]): [bigint, bigint] => [BigInt(arr[0]), BigInt(arr[1])];
  const toBigInt22 = (arr: string[][]): [[bigint, bigint], [bigint, bigint]] => [
    [BigInt(arr[0][0]), BigInt(arr[0][1])],
    [BigInt(arr[1][0]), BigInt(arr[1][1])],
  ];
  const toBigInt6 = (arr: string[]): [bigint, bigint, bigint, bigint, bigint, bigint] =>
    arr.slice(0, 6).map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint];

  onStage?.("proof-arguments-ready", {
    aLength: parsed[0].length,
    bOuterLength: parsed[1].length,
    cLength: parsed[2].length,
    publicSignalsLength: parsed[3].length,
  });

  return {
    a: toBigInt2(parsed[0]),
    b: toBigInt22(parsed[1]),
    c: toBigInt2(parsed[2]),
    pubSignals: toBigInt6(parsed[3]),
  };
}

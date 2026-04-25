# Ztocks Contract Architecture

## 🏗️ Complete Contract System

This document provides a comprehensive overview of all contracts and their interactions.

---

## 📦 Contract Overview

### Total Contracts: 6 Core + 1 External

| # | Contract | Type | Lines | Purpose |
|---|----------|------|-------|---------|
| 1 | **ZKVerifier.sol** | Identity | ~150 | Verify Groth16 ZK proofs for KYC |
| 2 | **ConfidentialTierManager.sol** | FHE | ~120 | Store encrypted tiers, check leverage |
| 3 | **ConfidentialUSDC.sol** | ERC7984 | ~80 | Encrypted USDC wrapper |
| 4 | **ConfidentialSynthToken.sol** | ERC7984 | ~150 | Encrypted synth tokens |
| 5 | **ConfidentialSynthVaultFHE.sol** | FHE | ~400 | Core trading vault |
| 6 | **FeeModule.sol** | Utility | ~100 | Protocol fee collection |
| 7 | **USDC.sol** | External | N/A | Standard ERC20 USDC |

---

## 🔗 Contract Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER WALLET                              │
│                    (MetaMask, WalletConnect)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  ZKVerifier   │   │ ConfidentialUSDC │   │ConfidentialSynth │
│               │   │   (ERC7984)      │   │  VaultFHE        │
│ - verifyProof │   │ - wrap USDC      │   │ - openPosition   │
│ - setTier     │   │ - unwrap USDC    │   │ - closePosition  │
└───────┬───────┘   └────────┬─────────┘   └────────┬─────────┘
        │                    │                       │
        │                    │                       │
        ↓                    ↓                       ↓
┌───────────────────┐  ┌──────────────┐   ┌──────────────────┐
│ConfidentialTier   │  │     USDC     │   │ConfidentialSynth │
│    Manager        │  │   (ERC20)    │   │  Token (ERC7984) │
│                   │  │              │   │                  │
│ - setTier         │  │ - transfer   │   │ - mint           │
│ - checkLeverage   │  │ - approve    │   │ - burn           │
│ - getMaxLeverage  │  │              │   │ - transfer       │
└───────────────────┘  └──────────────┘   └──────────────────┘
        ↑                                           ↑
        │                                           │
        └───────────────────┬───────────────────────┘
                            │
                    ┌───────────────┐
                    │  FeeModule    │
                    │               │
                    │ - collectFee  │
                    │ - withdrawFee │
                    └───────────────┘
```

---

## 📋 Contract Details

### 1. ZKVerifier.sol

**Purpose**: Verify Zero-Knowledge proofs for KYC tier verification

**Key Functions**:
```solidity
// Verify Groth16 proof and set tier
function verifyAndSetTier(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[1] calldata _pubSignals
) external

// Check if user is verified
function isVerified(address user) external view returns (bool)

// Get user's tier (plaintext, for display only)
function getUserTier(address user) external view returns (uint8)
```

**Interactions**:
- ✅ **Calls**: ConfidentialTierManager.setTier()
- ✅ **Called by**: User (via frontend)
- ✅ **Reads**: Groth16 verifier contract

**State Variables**:
```solidity
mapping(address => VerificationData) public verifiedUsers;
ConfidentialTierManager public tierManager;
```

---

### 2. ConfidentialTierManager.sol

**Purpose**: Store encrypted KYC tiers and enforce leverage caps

**Key Functions**:
```solidity
// Set encrypted tier (called by ZKVerifier)
function setTier(address user, uint8 tier) external onlyOwner

// Check if leverage is valid for user's tier (FHE operation)
function checkLeverage(address user, euint8 requestedLeverage) 
    external returns (ebool)

// Get max leverage for a tier (plaintext policy)
function getMaxLeverage(uint8 tier) external view returns (uint8)

// Update leverage cap (admin only)
function setMaxLeverage(uint8 tier, uint8 cap) external onlyOwner
```

**Interactions**:
- ✅ **Called by**: ZKVerifier (setTier), ConfidentialSynthVaultFHE (checkLeverage)
- ✅ **Calls**: FHE library (asEuint8, eq, le, and, or)

**State Variables**:
```solidity
mapping(address => euint8) private encryptedTier;  // Encrypted tier per user
mapping(uint8 => uint8) public maxLeverage;        // Tier => max leverage
```

**Leverage Caps**:
| Tier | Description | Max Leverage |
|------|-------------|--------------|
| 1 | Basic KYC | 2x |
| 2 | Accredited Investor | 5x |
| 3 | High Net Worth | 8x |
| 4 | Institutional / QIB | 10x |

---

### 3. ConfidentialUSDC.sol

**Purpose**: ERC7984 wrapper for USDC (encrypted collateral)

**Key Functions**:
```solidity
// Wrap USDC → cUSDC (instant)
function depositFor(address account, uint256 amount) 
    external returns (bool)

// Unwrap cUSDC → USDC (step 1: request)
function unwrap(
    address from,
    address to,
    externalEuint64 encryptedAmount,
    bytes calldata inputProof
) external

// Unwrap cUSDC → USDC (step 2: finalize)
function finalizeUnwrap(
    bytes32 unwrapRequestId,
    uint64 cleartextAmount,
    bytes calldata decryptionProof
) external
```

**Interactions**:
- ✅ **Calls**: USDC.transferFrom(), USDC.transfer()
- ✅ **Called by**: User (wrap/unwrap)
- ✅ **Inherits**: ERC7984ERC20Wrapper, ERC7984

**State Variables**:
```solidity
IERC20 public underlying;  // USDC token
mapping(bytes32 => UnwrapRequest) public unwrapRequests;
```

**Events**:
```solidity
event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, euint64 amount);
event UnwrapFinalized(address indexed receiver, bytes32 indexed unwrapRequestId, euint64 encryptedAmount, uint64 cleartextAmount);
```

---

### 4. ConfidentialSynthToken.sol

**Purpose**: ERC7984 confidential synthetic equity tokens

**Key Functions**:
```solidity
// Set vault address (one-time, owner only)
function setVault(address vaultAddress) external onlyOwner

// Mint encrypted tokens (vault only)
function mint(address to, euint64 encryptedAmount) 
    external onlyVault returns (euint64)

// Burn encrypted tokens (vault only)
function burn(address from, euint64 encryptedAmount) 
    external onlyVault returns (euint64)

// Mint with external encrypted input (vault only)
function confidentialMint(
    address to,
    externalEuint64 encryptedAmount,
    bytes calldata inputProof
) external onlyVault returns (euint64)

// Get encrypted balance (anyone can call, only holder can decrypt)
function confidentialBalanceOf(address account) 
    external view returns (euint64)
```

**Interactions**:
- ✅ **Called by**: ConfidentialSynthVaultFHE (mint/burn)
- ✅ **Inherits**: ERC7984, Ownable2Step

**State Variables**:
```solidity
address public vault;
string public underlyingAsset;  // e.g., "AAPL"
```

**Deployed Instances**:
- csAAPL (Confidential Synthetic Apple)
- csTSLA (Confidential Synthetic Tesla)
- csNVDA (Confidential Synthetic NVIDIA)
- csSPY (Confidential Synthetic S&P 500)

---

### 5. ConfidentialSynthVaultFHE.sol

**Purpose**: Core trading vault with FHE-encrypted positions

**Key Functions**:
```solidity
// Open position with encrypted inputs
function openPosition(
    address synthToken,
    externalEbool encIsLong,
    externalEuint64 encCollateralUSDC,
    externalEuint8 encLeverage,
    externalEuint64 encExecutionPrice,
    bytes calldata inputProof
) external nonReentrant whenNotPaused

// Open position with hybrid approach (plaintext collateral)
function openPositionHybrid(
    address synthToken,
    bool isLong,
    uint256 collateralUSDC,
    externalEuint8 encLeverage,
    uint256 executionPrice,
    bytes calldata inputProof
) external nonReentrant whenNotPaused

// Close position
function closePosition(uint256 positionId, uint256 executionPrice) 
    external nonReentrant whenNotPaused

// Get user's positions
function getUserPositions(address user) 
    external view returns (EncryptedPosition[] memory)

// Register synth asset (admin only)
function registerSynthAsset(address synthToken) external onlyOwner

// Pause/unpause trading (admin only)
function pause() external onlyOwner
function unpause() external onlyOwner
```

**Interactions**:
- ✅ **Calls**: 
  - ZKVerifier.isVerified()
  - ConfidentialTierManager.checkLeverage()
  - ConfidentialSynthToken.mint() / burn()
  - USDC.transferFrom() / transfer()
  - FeeModule.collectOpenFee()
- ✅ **Called by**: User (open/close positions)

**State Variables**:
```solidity
ZKVerifier public immutable zkVerifier;
ConfidentialTierManager public immutable tierManager;
IERC20 public immutable usdc;
FeeModule public feeModule;

mapping(address => bool) public registeredAssets;
mapping(address => EncryptedPosition[]) public positions;
```

**Position Structure**:
```solidity
struct EncryptedPosition {
    address asset;           // SynthToken address (plaintext)
    ebool isLong;           // ENCRYPTED: LONG/SHORT
    euint64 collateralUSDC; // ENCRYPTED: collateral amount
    euint8 leverage;        // ENCRYPTED: leverage multiplier
    euint64 entryPrice;     // ENCRYPTED: entry price
    euint64 synthAmount;    // ENCRYPTED: synth tokens minted
    uint256 openTime;       // plaintext: timestamp
    bool isOpen;            // plaintext: open/closed status
}
```

---

### 6. FeeModule.sol

**Purpose**: Collect and manage protocol fees

**Key Functions**:
```solidity
// Collect opening fee
function collectOpenFee(address user, uint256 collateralAmount) 
    external onlyVault returns (uint256 feeAmount)

// Collect closing fee
function collectCloseFee(address user, uint256 pnlAmount) 
    external onlyVault returns (uint256 feeAmount)

// Withdraw collected fees (admin only)
function withdrawFees(address token, address to, uint256 amount) 
    external onlyOwner

// Update fee rates (admin only)
function setOpenFeeRate(uint256 newRate) external onlyOwner
function setCloseFeeRate(uint256 newRate) external onlyOwner
```

**Interactions**:
- ✅ **Called by**: ConfidentialSynthVaultFHE
- ✅ **Calls**: USDC.transfer()

**State Variables**:
```solidity
address public vault;
uint256 public openFeeRate;   // e.g., 10 = 0.1%
uint256 public closeFeeRate;  // e.g., 10 = 0.1%
mapping(address => uint256) public collectedFees;
```

---

### 7. USDC.sol (External)

**Purpose**: Standard ERC20 USDC token

**Key Functions**:
```solidity
function transfer(address to, uint256 amount) external returns (bool)
function approve(address spender, uint256 amount) external returns (bool)
function transferFrom(address from, address to, uint256 amount) external returns (bool)
function balanceOf(address account) external view returns (uint256)
```

**Interactions**:
- ✅ **Called by**: User, ConfidentialUSDC, ConfidentialSynthVaultFHE

---

## 🔄 Interaction Flow Diagrams

### Flow 1: User Registration

```
User Wallet
    │
    │ 1. Generate ZK proof (off-chain)
    ↓
ZKVerifier.verifyAndSetTier()
    │
    │ 2. Verify Groth16 proof
    │ 3. Extract tier from public signals
    ↓
ConfidentialTierManager.setTier()
    │
    │ 4. Encrypt tier as euint8
    │ 5. Store encrypted tier
    │ 6. Allow user to decrypt
    ↓
User is verified ✓
```

### Flow 2: Deposit Collateral

```
User Wallet
    │
    │ 1. Approve USDC spending
    ↓
USDC.approve(ConfidentialUSDC, amount)
    │
    │ 2. Wrap USDC → cUSDC
    ↓
ConfidentialUSDC.depositFor()
    │
    ├─→ USDC.transferFrom(user, cUSDC, amount)
    │
    │ 3. Mint encrypted cUSDC
    ↓
User has encrypted cUSDC balance ✓
```

### Flow 3: Open Position

```
User Wallet
    │
    │ 1. Encrypt parameters (off-chain)
    │    - collateral, leverage, price
    ↓
ConfidentialSynthVaultFHE.openPosition()
    │
    ├─→ ZKVerifier.isVerified(user) ✓
    │
    ├─→ ConfidentialTierManager.checkLeverage(user, encLeverage)
    │       │
    │       │ FHE operations on encrypted data:
    │       │ - Get encrypted tier
    │       │ - Compare with leverage caps
    │       │ - Return encrypted boolean
    │       ↓
    │   Leverage valid ✓
    │
    ├─→ USDC.transferFrom(user, vault, collateral)
    │
    ├─→ FeeModule.collectOpenFee(user, collateral)
    │
    ├─→ ConfidentialSynthToken.mint(user, encSynthAmount)
    │
    │ 2. Store encrypted position
    ↓
Position opened ✓
```

### Flow 4: Close Position

```
User Wallet
    │
    │ 1. Request position close
    ↓
ConfidentialSynthVaultFHE.closePosition()
    │
    ├─→ ConfidentialSynthToken.burn(user, encSynthAmount)
    │
    ├─→ Calculate P&L (simplified for demo)
    │
    ├─→ USDC.transfer(user, collateral + profit)
    │
    │ 2. Mark position as closed
    ↓
Position closed ✓
```

### Flow 5: Withdraw Funds

```
User Wallet
    │
    │ 1. Encrypt unwrap amount (off-chain)
    ↓
ConfidentialUSDC.unwrap()
    │
    │ 2. Burn encrypted cUSDC
    │ 3. Emit UnwrapRequested event
    ↓
Relayer (off-chain)
    │
    │ 4. Decrypt amount
    │ 5. Generate decryption proof
    ↓
ConfidentialUSDC.finalizeUnwrap()
    │
    │ 6. Verify decryption proof
    ├─→ USDC.transfer(user, amount)
    │
    │ 7. Mark as finalized
    ↓
User receives USDC ✓
```

---

## 🔐 Security Model

### Access Control

| Contract | Function | Access Control |
|----------|----------|----------------|
| ZKVerifier | verifyAndSetTier | Anyone (proof verified) |
| ZKVerifier | setTierManager | Owner only |
| TierManager | setTier | Owner only (ZKVerifier) |
| TierManager | checkLeverage | Anyone (returns encrypted) |
| TierManager | setMaxLeverage | Owner only |
| ConfidentialUSDC | depositFor | Anyone |
| ConfidentialUSDC | unwrap | Token holder or approved |
| ConfidentialUSDC | finalizeUnwrap | Anyone (proof verified) |
| ConfidentialSynthToken | setVault | Owner only (one-time) |
| ConfidentialSynthToken | mint/burn | Vault only |
| Vault | openPosition | Verified users only |
| Vault | closePosition | Position owner only |
| Vault | registerSynthAsset | Owner only |
| Vault | pause/unpause | Owner only |
| FeeModule | collectFee | Vault only |
| FeeModule | withdrawFees | Owner only |

### Encryption Layers

| Data Type | Encryption | Decryption |
|-----------|-----------|------------|
| KYC Tier | euint8 (FHE) | User + Admin |
| Position Collateral | euint64 (FHE) | Position owner |
| Position Leverage | euint8 (FHE) | Position owner |
| Position Direction | ebool (FHE) | Position owner |
| Synth Balance | euint64 (ERC7984) | Token holder |
| cUSDC Balance | euint64 (ERC7984) | Token holder |

---

## 📊 Gas Estimates

| Operation | Estimated Gas | Notes |
|-----------|--------------|-------|
| verifyAndSetTier | ~300k | Includes Groth16 verification |
| depositFor (wrap) | ~100k | Similar to ERC20 transfer |
| unwrap (request) | ~150k | Burns encrypted tokens |
| finalizeUnwrap | ~200k | Includes proof verification |
| openPosition | ~500k | Includes FHE operations |
| closePosition | ~300k | Includes token burn |
| mint (synth token) | ~200k | FHE encryption overhead |
| transfer (synth token) | ~250k | FHE operations |

---

## 🎯 Summary

### Contract Count
- **6 Core Contracts**: ZKVerifier, TierManager, cUSDC, SynthToken, Vault, FeeModule
- **1 External Contract**: USDC
- **Total: 7 Contracts**

### Privacy Layers
- **Layer 1 (ZK)**: Identity privacy via ZK proofs
- **Layer 2 (FHE)**: Position privacy via FHE encryption
- **Layer 3 (ERC7984)**: Balance privacy via confidential tokens

### Key Innovations
1. **Encrypted Leverage Enforcement**: Check leverage on encrypted data
2. **Triple Privacy Stack**: ZK + FHE + ERC7984
3. **Standard Compliance**: OpenZeppelin ERC7984
4. **MEV Protection**: All sensitive data encrypted

---

**Complete contract architecture for maximum privacy! 🔒**

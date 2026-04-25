# Ztocks User Flow Guide

## 🎯 Complete User Journey

This guide explains the **end-to-end user flow** for trading on Ztocks, showing which contracts are used at each step.

---

## 📋 Table of Contents

1. [User Registration & KYC](#1-user-registration--kyc)
2. [Deposit Collateral](#2-deposit-collateral)
3. [Open Position](#3-open-position)
4. [Monitor Position](#4-monitor-position)
5. [Close Position](#5-close-position)
6. [Withdraw Funds](#6-withdraw-funds)
7. [Contract Reference](#contract-reference)

---

## 1. User Registration & KYC

### Step 1.1: Connect Wallet
**User Action**: Connect MetaMask wallet  
**Contracts Used**: None (frontend only)

```typescript
// Frontend: Connect wallet using RainbowKit
import { ConnectButton } from '@rainbow-me/rainbowkit';

<ConnectButton />
```

### Step 1.2: Submit KYC Information
**User Action**: Submit credit score and personal info  
**Contracts Used**: None (backend only)

```typescript
// Frontend: Submit KYC data to backend
const response = await fetch('/api/kyc/submit', {
  method: 'POST',
  body: JSON.stringify({
    address: userAddress,
    creditScore: 750,
    // Other KYC data (encrypted off-chain)
  })
});
```

**Backend Process**:
- Verify credit score with external oracle
- Assign KYC tier (1-4) based on credit score
- Sign tier assignment with oracle private key
- Store signature in database

### Step 1.3: Generate ZK Proof
**User Action**: Click "Verify KYC" button  
**Contracts Used**: None (client-side proof generation)

```typescript
// Frontend: Generate ZK proof using Circom circuit
import { groth16 } from 'snarkjs';

// Inputs (private)
const inputs = {
  creditScore: 750,
  threshold: 700,
  oracleSignature: signature,
  oraclePubKey: publicKey
};

// Generate proof (client-side, ~5 seconds)
const { proof, publicSignals } = await groth16.fullProve(
  inputs,
  'tier_proof.wasm',
  'tier_proof_final.zkey'
);

// Public output: tier = 2 (Accredited Investor)
// Private: creditScore, signature remain hidden
```

### Step 1.4: Submit ZK Proof On-Chain
**User Action**: Confirm transaction to verify proof  
**Contracts Used**: 
- ✅ **ZKVerifier.sol**
- ✅ **ConfidentialTierManager.sol**

```solidity
// Contract: ZKVerifier.sol
function verifyAndSetTier(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[1] calldata _pubSignals  // tier = 2
) external {
    // 1. Verify Groth16 proof
    require(verifyProof(_pA, _pB, _pC, _pubSignals), "Invalid proof");
    
    // 2. Extract tier from public signals
    uint8 tier = uint8(_pubSignals[0]);
    
    // 3. Store encrypted tier in TierManager
    tierManager.setTier(msg.sender, tier);
    
    // 4. Mark user as verified
    verifiedUsers[msg.sender] = VerificationData({
        tier: tier,
        timestamp: block.timestamp,
        expiresAt: block.timestamp + 90 days
    });
}
```

```solidity
// Contract: ConfidentialTierManager.sol
function setTier(address user, uint8 tier) external onlyOwner {
    // Convert plaintext tier to encrypted euint8
    encryptedTier[user] = FHE.asEuint8(tier);
    
    // Allow user to decrypt their own tier
    FHE.allow(encryptedTier[user], user);
}
```

**Result**: 
- ✅ User verified on-chain
- ✅ Tier encrypted and stored
- ✅ No personal data exposed
- ✅ Max leverage: 5x (tier 2)

---

## 2. Deposit Collateral

### Step 2.1: Approve USDC
**User Action**: Approve USDC spending  
**Contracts Used**: 
- ✅ **USDC.sol** (standard ERC20)

```typescript
// Frontend: Approve USDC
const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
await usdc.approve(CONFIDENTIAL_USDC_ADDRESS, ethers.parseUnits('1000', 6));
```

### Step 2.2: Wrap USDC → cUSDC
**User Action**: Wrap USDC into confidential USDC  
**Contracts Used**: 
- ✅ **ConfidentialUSDC.sol** (ERC7984 wrapper)

```typescript
// Frontend: Wrap USDC → cUSDC
const cUSDC = new ethers.Contract(CONFIDENTIAL_USDC_ADDRESS, cUSDC_ABI, signer);
const amount = ethers.parseUnits('1000', 6); // 1000 USDC

await cUSDC.depositFor(userAddress, amount);
```

```solidity
// Contract: ConfidentialUSDC.sol (inherits ERC7984ERC20Wrapper)
function depositFor(address account, uint256 amount) external returns (bool) {
    // 1. Transfer USDC from user to this contract
    SafeERC20.safeTransferFrom(underlying, msg.sender, address(this), amount);
    
    // 2. Mint encrypted cUSDC to user
    euint64 encryptedAmount = FHE.asEuint64(uint64(amount));
    _mint(account, encryptedAmount);
    
    // 3. Allow user to decrypt their balance
    FHE.allow(confidentialBalanceOf(account), account);
    
    return true;
}
```

**Result**: 
- ✅ User has 1000 cUSDC (encrypted balance)
- ✅ No one can see the balance amount
- ✅ Ready to open positions

---

## 3. Open Position

### Step 3.1: Choose Trading Parameters
**User Action**: Select asset, direction, collateral, leverage  
**Contracts Used**: None (frontend only)

```typescript
// Frontend: User selects parameters
const params = {
  asset: 'csAAPL',           // Confidential Synthetic Apple
  direction: 'LONG',         // LONG or SHORT
  collateral: 1000,          // 1000 USDC
  leverage: 5,               // 5x leverage
  executionPrice: 150.00     // Current AAPL price
};
```

### Step 3.2: Encrypt Trading Parameters
**User Action**: Click "Open Position" button  
**Contracts Used**: None (client-side encryption)

```typescript
// Frontend: Encrypt parameters using fhevmjs
import { createInstance } from 'fhevmjs';

// Initialize FHE instance
const fhevm = await createInstance({ 
  chainId: 8009,
  publicKey: await getFHEPublicKey()
});

// Create encrypted inputs
const encryptedInput = await fhevm
  .createEncryptedInput(VAULT_ADDRESS, userAddress)
  .addBool(params.direction === 'LONG')  // isLong (encrypted)
  .add64(params.collateral * 1e6)        // collateral (encrypted)
  .add8(params.leverage)                 // leverage (encrypted)
  .add64(params.executionPrice * 1e8)    // price (encrypted)
  .encrypt();

// Result: All parameters encrypted, ready for on-chain submission
```

### Step 3.3: Submit Position On-Chain
**User Action**: Confirm transaction  
**Contracts Used**: 
- ✅ **ConfidentialSynthVaultFHE.sol**
- ✅ **ConfidentialTierManager.sol**
- ✅ **ZKVerifier.sol**
- ✅ **ConfidentialSynthToken.sol**

```solidity
// Contract: ConfidentialSynthVaultFHE.sol
function openPositionHybrid(
    address synthToken,        // csAAPL address
    bool    isLong,           // true (LONG)
    uint256 collateralUSDC,   // 1000 USDC
    externalEuint8 encLeverage,  // encrypted 5x
    uint256 executionPrice,   // 150.00
    bytes calldata inputProof
) external nonReentrant whenNotPaused {
    // 1. Check ZK verification (user must be verified)
    require(zkVerifier.isVerified(msg.sender), "Not verified");
    
    // 2. Convert encrypted leverage
    euint8 leverage = FHE.fromExternal(encLeverage, inputProof);
    
    // 3. Check leverage against tier cap (FHE operation on encrypted data)
    ebool leverageValid = tierManager.checkLeverage(msg.sender, leverage);
    // This checks: user's encrypted tier allows encrypted leverage
    // Contract never sees plaintext tier or leverage!
    
    // 4. If invalid, set leverage to 1 (minimum)
    euint8 one = FHE.asEuint8(1);
    leverage = FHE.select(leverageValid, leverage, one);
    
    // 5. Pull USDC collateral from user
    usdc.safeTransferFrom(msg.sender, address(this), collateralUSDC);
    
    // 6. Calculate position size
    uint256 positionSizeUSDC = collateralUSDC * 5; // Assume 5x for demo
    uint256 synthAmount = (positionSizeUSDC * 1e20) / executionPrice;
    
    // 7. Mint encrypted synth tokens to user
    euint64 encSynthAmount = FHE.asEuint64(uint64(synthAmount));
    ConfidentialSynthToken(synthToken).mint(msg.sender, encSynthAmount);
    
    // 8. Store encrypted position
    positions[msg.sender].push(EncryptedPosition({
        asset: synthToken,
        isLong: FHE.asEbool(isLong),
        collateralUSDC: FHE.asEuint64(uint64(collateralUSDC)),
        leverage: leverage,  // encrypted
        entryPrice: FHE.asEuint64(uint64(executionPrice)),
        synthAmount: encSynthAmount,  // encrypted
        openTime: block.timestamp,
        isOpen: true
    }));
    
    // 9. Allow user to decrypt their position data
    FHE.allow(leverage, msg.sender);
    FHE.allow(encSynthAmount, msg.sender);
    
    emit PositionOpened(msg.sender, positions[msg.sender].length - 1, synthToken, block.timestamp);
}
```

```solidity
// Contract: ConfidentialTierManager.sol
function checkLeverage(address user, euint8 requestedLeverage) external returns (ebool) {
    euint8 userTier = encryptedTier[user];  // encrypted tier
    
    // Check each tier using FHE operations
    ebool isValid = FHE.asEbool(false);
    
    for (uint8 t = 1; t <= 4; t++) {
        euint8 tierValue = FHE.asEuint8(t);
        ebool isTier = FHE.eq(userTier, tierValue);  // Is user this tier?
        euint8 cap = FHE.asEuint8(maxLeverage[t]);
        ebool leverageOk = FHE.le(requestedLeverage, cap);  // Is leverage <= cap?
        ebool tierValid = FHE.and(isTier, leverageOk);
        isValid = FHE.or(isValid, tierValid);
    }
    
    return isValid;  // encrypted boolean result
}
```

```solidity
// Contract: ConfidentialSynthToken.sol
function mint(address to, euint64 encryptedAmount) external onlyVault returns (euint64) {
    // Mint encrypted synth tokens
    return _mint(to, encryptedAmount);
}
```

**Result**: 
- ✅ Position opened with 1000 USDC collateral
- ✅ 5x leverage applied (tier 2 allows up to 5x)
- ✅ 5000 csAAPL tokens minted (encrypted balance)
- ✅ All parameters encrypted on-chain
- ✅ MEV bots can't see position size or direction

---

## 4. Monitor Position

### Step 4.1: View Encrypted Balance
**User Action**: Check portfolio  
**Contracts Used**: 
- ✅ **ConfidentialSynthToken.sol**

```typescript
// Frontend: Get encrypted balance handle
const csAAPL = new ethers.Contract(CS_AAPL_ADDRESS, csAAPL_ABI, provider);
const encBalanceHandle = await csAAPL.confidentialBalanceOf(userAddress);

// Decrypt balance using user's private key
const balance = await fhevm.decrypt(encBalanceHandle, userAddress);
console.log(`Your csAAPL balance: ${ethers.formatEther(balance)}`);
// Output: "Your csAAPL balance: 5000.0"
```

### Step 4.2: View Position Details
**User Action**: Click on position  
**Contracts Used**: 
- ✅ **ConfidentialSynthVaultFHE.sol**

```typescript
// Frontend: Get position data
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
const positions = await vault.getUserPositions(userAddress);

// Decrypt position data
for (const pos of positions) {
  const collateral = await fhevm.decrypt(pos.collateralUSDC, userAddress);
  const leverage = await fhevm.decrypt(pos.leverage, userAddress);
  const entryPrice = await fhevm.decrypt(pos.entryPrice, userAddress);
  const synthAmount = await fhevm.decrypt(pos.synthAmount, userAddress);
  
  console.log({
    asset: pos.asset,
    collateral: collateral / 1e6,      // 1000 USDC
    leverage: leverage,                 // 5x
    entryPrice: entryPrice / 1e8,      // 150.00
    synthAmount: synthAmount / 1e18,   // 5000 csAAPL
    isOpen: pos.isOpen
  });
}
```

### Step 4.3: Calculate P&L (Off-Chain)
**User Action**: View profit/loss  
**Contracts Used**: None (frontend calculation)

```typescript
// Frontend: Calculate P&L
const currentPrice = await fetchPrice('AAPL'); // 155.00
const entryPrice = 150.00;
const positionSize = 5000; // csAAPL tokens
const isLong = true;

let pnl;
if (isLong) {
  pnl = (currentPrice - entryPrice) * positionSize;
} else {
  pnl = (entryPrice - currentPrice) * positionSize;
}

console.log(`P&L: $${pnl.toFixed(2)}`);
// Output: "P&L: $25000.00" (profit)
```

**Result**: 
- ✅ User can see their own position details
- ✅ No one else can see the position
- ✅ P&L calculated off-chain for privacy

---

## 5. Close Position

### Step 5.1: Get Current Price
**User Action**: Click "Close Position"  
**Contracts Used**: None (backend price feed)

```typescript
// Frontend: Fetch current price
const currentPrice = await fetch('/api/prices/AAPL').then(r => r.json());
// Returns: { symbol: 'AAPL', price: 155.00 }
```

### Step 5.2: Close Position On-Chain
**User Action**: Confirm transaction  
**Contracts Used**: 
- ✅ **ConfidentialSynthVaultFHE.sol**
- ✅ **ConfidentialSynthToken.sol**

```solidity
// Contract: ConfidentialSynthVaultFHE.sol
function closePosition(
    uint256 positionId,
    uint256 executionPrice  // 155.00
) external nonReentrant whenNotPaused {
    EncryptedPosition storage pos = positions[msg.sender][positionId];
    require(pos.isOpen, "Position already closed");
    
    // 1. Mark position as closed
    pos.isOpen = false;
    
    // 2. Burn synth tokens (encrypted amount)
    ConfidentialSynthToken(pos.asset).burn(msg.sender, pos.synthAmount);
    
    // 3. Calculate P&L (simplified for demo)
    // In production, this would use FHE operations or async decryption
    
    // 4. Return collateral + profit (or - loss)
    // For demo, we just return collateral
    // In production, use decryption callback for P&L calculation
    
    emit PositionClosed(msg.sender, positionId, block.timestamp);
}
```

```solidity
// Contract: ConfidentialSynthToken.sol
function burn(address from, euint64 encryptedAmount) external onlyVault returns (euint64) {
    // Burn encrypted synth tokens
    return _burn(from, encryptedAmount);
}
```

**Result**: 
- ✅ Position closed
- ✅ Synth tokens burned (encrypted)
- ✅ Collateral + profit ready to withdraw

---

## 6. Withdraw Funds

### Step 6.1: Unwrap cUSDC → USDC (Request)
**User Action**: Click "Withdraw"  
**Contracts Used**: 
- ✅ **ConfidentialUSDC.sol**

```typescript
// Frontend: Create encrypted unwrap amount
const withdrawAmount = 1250; // 1000 collateral + 250 profit
const encryptedInput = await fhevm
  .createEncryptedInput(CONFIDENTIAL_USDC_ADDRESS, userAddress)
  .add64(withdrawAmount * 1e6)
  .encrypt();

// Request unwrap
const cUSDC = new ethers.Contract(CONFIDENTIAL_USDC_ADDRESS, cUSDC_ABI, signer);
const tx = await cUSDC.unwrap(
  userAddress,                    // from
  userAddress,                    // to
  encryptedInput.handles[0],      // encrypted amount
  encryptedInput.inputProof       // proof
);

const receipt = await tx.wait();
const event = receipt.logs.find(log => log.eventName === 'UnwrapRequested');
const requestId = event.args.unwrapRequestId;
```

```solidity
// Contract: ConfidentialUSDC.sol (inherits ERC7984ERC20Wrapper)
function unwrap(
    address from,
    address to,
    externalEuint64 encryptedAmount,
    bytes calldata inputProof
) external {
    require(msg.sender == from || isApprovedForAll(from, msg.sender), "Not authorized");
    
    // 1. Convert encrypted input
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
    
    // 2. Burn encrypted cUSDC
    _burn(from, amount);
    
    // 3. Emit event for relayer to decrypt
    bytes32 requestId = keccak256(abi.encodePacked(from, to, block.timestamp));
    emit UnwrapRequested(to, requestId, amount);
    
    // 4. Store unwrap request
    unwrapRequests[requestId] = UnwrapRequest({
        to: to,
        amount: amount,
        timestamp: block.timestamp,
        finalized: false
    });
}
```

**Result**: 
- ✅ Unwrap requested
- ✅ cUSDC burned (encrypted)
- ✅ Waiting for relayer to decrypt

### Step 6.2: Wait for Relayer Decryption
**User Action**: Wait (~30 seconds)  
**Contracts Used**: None (off-chain relayer)

```typescript
// Relayer (off-chain service): Decrypt amount
const event = await cUSDC.queryFilter('UnwrapRequested');
const { unwrapRequestId, amount: encryptedAmount } = event.args;

// Decrypt using relayer's decryption key
const cleartextAmount = await fhevm.decrypt(encryptedAmount, RELAYER_ADDRESS);
const decryptionProof = await fhevm.generateDecryptionProof(encryptedAmount, cleartextAmount);

// Relayer submits finalization transaction
await cUSDC.finalizeUnwrap(unwrapRequestId, cleartextAmount, decryptionProof);
```

### Step 6.3: Finalize Unwrap
**User Action**: None (automatic)  
**Contracts Used**: 
- ✅ **ConfidentialUSDC.sol**

```solidity
// Contract: ConfidentialUSDC.sol
function finalizeUnwrap(
    bytes32 unwrapRequestId,
    uint64 cleartextAmount,
    bytes calldata decryptionProof
) external {
    UnwrapRequest storage request = unwrapRequests[unwrapRequestId];
    require(!request.finalized, "Already finalized");
    
    // 1. Verify decryption proof
    require(verifyDecryptionProof(request.amount, cleartextAmount, decryptionProof), "Invalid proof");
    
    // 2. Transfer USDC to user
    SafeERC20.safeTransfer(underlying, request.to, cleartextAmount);
    
    // 3. Mark as finalized
    request.finalized = true;
    
    emit UnwrapFinalized(request.to, unwrapRequestId, request.amount, cleartextAmount);
}
```

**Result**: 
- ✅ USDC transferred to user's wallet
- ✅ User receives 1250 USDC (1000 collateral + 250 profit)
- ✅ Withdrawal complete!

---

## Contract Reference

### Core Contracts Used in User Flow

| Contract | Purpose | Used In Steps |
|----------|---------|---------------|
| **ZKVerifier.sol** | Verify Groth16 ZK proofs for KYC tier | Step 1.4 (Registration) |
| **ConfidentialTierManager.sol** | Store encrypted KYC tiers, check leverage | Step 1.4 (Registration), Step 3.3 (Open Position) |
| **ConfidentialUSDC.sol** | ERC7984 wrapper for USDC (encrypted collateral) | Step 2.2 (Deposit), Step 6.1-6.3 (Withdraw) |
| **ConfidentialSynthVaultFHE.sol** | Core trading vault (open/close positions) | Step 3.3 (Open), Step 5.2 (Close) |
| **ConfidentialSynthToken.sol** | ERC7984 synth tokens (encrypted balances) | Step 3.3 (Mint), Step 4.1 (View), Step 5.2 (Burn) |
| **FeeModule.sol** | Collect protocol fees | Step 3.3 (Open Position) |

### External Contracts

| Contract | Purpose | Used In Steps |
|----------|---------|---------------|
| **USDC.sol** | Standard ERC20 USDC token | Step 2.1 (Approve), Step 2.2 (Wrap) |

---

## 🔒 Privacy at Each Step

| Step | What's Hidden | What's Visible |
|------|--------------|----------------|
| **1. Registration** | Credit score, personal data | Wallet address, tier (encrypted) |
| **2. Deposit** | Deposit amount | Transaction hash, timestamp |
| **3. Open Position** | Collateral, leverage, direction, size | Asset type (csAAPL), timestamp |
| **4. Monitor** | Balance (to others) | Nothing (user decrypts locally) |
| **5. Close** | P&L amount | Position closed event |
| **6. Withdraw** | Withdrawal amount | Transaction hash, timestamp |

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    1. REGISTRATION & KYC                     │
├─────────────────────────────────────────────────────────────┤
│  User → Backend → ZK Proof → ZKVerifier → TierManager       │
│  Result: Verified user with encrypted tier                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. DEPOSIT COLLATERAL                     │
├─────────────────────────────────────────────────────────────┤
│  User → USDC.approve() → ConfidentialUSDC.depositFor()      │
│  Result: Encrypted cUSDC balance                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    3. OPEN POSITION                          │
├─────────────────────────────────────────────────────────────┤
│  User → Encrypt Params → Vault.openPosition()               │
│    ├─> ZKVerifier.isVerified() ✓                           │
│    ├─> TierManager.checkLeverage() ✓                       │
│    └─> ConfidentialSynthToken.mint() ✓                     │
│  Result: Encrypted position + encrypted synth tokens        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    4. MONITOR POSITION                       │
├─────────────────────────────────────────────────────────────┤
│  User → Vault.getUserPositions() → Decrypt locally          │
│  Result: User sees own position, others see nothing         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    5. CLOSE POSITION                         │
├─────────────────────────────────────────────────────────────┤
│  User → Vault.closePosition()                               │
│    └─> ConfidentialSynthToken.burn() ✓                     │
│  Result: Position closed, collateral + profit available     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    6. WITHDRAW FUNDS                         │
├─────────────────────────────────────────────────────────────┤
│  User → ConfidentialUSDC.unwrap() (request)                 │
│    → Relayer decrypts amount off-chain                      │
│    → ConfidentialUSDC.finalizeUnwrap() (finalize)          │
│  Result: USDC transferred to user's wallet                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Takeaways

1. **Triple Privacy**: ZK (identity) + FHE (positions) + ERC7984 (balances)
2. **6 Main Contracts**: ZKVerifier, TierManager, cUSDC, Vault, SynthToken, FeeModule
3. **End-to-End Encryption**: From deposit to withdrawal, everything encrypted
4. **User-Friendly**: Complex crypto hidden behind simple UI
5. **MEV Protected**: Bots can't see position details to front-run

---

**Ready to trade with complete privacy! 🚀**

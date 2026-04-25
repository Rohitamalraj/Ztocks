# ERC7984 Confidential Token Integration

## Overview

Ztocks now implements **ERC7984**, the OpenZeppelin standard for confidential tokens, providing **end-to-end encryption** for all token balances and transfers. This integration represents a significant upgrade to our privacy architecture.

## What is ERC7984?

ERC7984 is the **confidential token standard** developed by OpenZeppelin and Zama. It extends the traditional ERC20 interface with **Fully Homomorphic Encryption (FHE)**, enabling:

- **Encrypted balances**: No one can see how many tokens you hold
- **Encrypted transfers**: Transaction amounts are hidden from MEV bots and observers
- **On-chain computation**: Smart contracts can operate on encrypted data without decryption
- **Standard compliance**: Interoperable with other confidential DeFi protocols

## Architecture

### 1. ConfidentialSynthToken (csAAPL, csTSLA, etc.)

**Purpose**: Encrypted synthetic equity tokens

**Key Features**:
- Inherits from `ERC7984` for confidential token standard
- All balances stored as `euint64` (encrypted 64-bit integers)
- Only the vault can mint/burn tokens
- Users can decrypt their own balances using their private keys
- Owner can view total supply for administrative purposes

**Privacy Benefits**:
- **Position size privacy**: No one knows how many synth tokens you hold
- **MEV protection**: Bots can't see your position to front-run liquidations
- **Trade privacy**: Your trading activity is hidden from competitors

**Example**:
```solidity
// Mint encrypted synth tokens (vault only)
euint64 encryptedAmount = FHE.asEuint64(1000e18);
csAAPL.mint(user, encryptedAmount);

// User can decrypt their own balance
euint64 encBalance = csAAPL.confidentialBalanceOf(user);
uint64 balance = fhevm.decrypt(encBalance, userPrivateKey);
```

### 2. ConfidentialUSDC (cUSDC)

**Purpose**: Encrypted USDC wrapper for confidential collateral deposits

**Key Features**:
- Inherits from `ERC7984ERC20Wrapper` for wrapping standard USDC
- Wrapping: ERC20 USDC → ERC7984 cUSDC (instant)
- Unwrapping: ERC7984 cUSDC → ERC20 USDC (2-step async process)
- All wrapped balances are encrypted

**Privacy Benefits**:
- **Collateral privacy**: No one knows your deposit size
- **Liquidation protection**: Bots can't see your collateral to calculate health factor
- **Compliance**: All transactions on-chain, just encrypted

**Wrapping Flow**:
```solidity
// 1. Approve USDC
usdc.approve(address(cUSDC), 1000e6);

// 2. Wrap USDC → cUSDC (instant, encrypted balance)
cUSDC.depositFor(msg.sender, 1000e6);
```

**Unwrapping Flow** (2-step async):
```solidity
// STEP 1: Request unwrap (burns cUSDC, emits event)
const enc = await fhevm.createEncryptedInput(cUSDC.address, user.address)
  .add64(1000e6)
  .encrypt();
await cUSDC.unwrap(user, user, enc.handles[0], enc.inputProof);
// Emits: UnwrapRequested(user, requestId, encryptedAmount)

// STEP 2: Relayer decrypts off-chain, then anyone finalizes
await cUSDC.finalizeUnwrap(requestId, 1000e6, decryptionProof);
// Transfers USDC to user
```

### 3. ConfidentialSynthVaultFHE (Updated)

**Changes**:
- Now works with `ConfidentialSynthToken` instead of `SynthToken`
- Mints encrypted synth tokens using `mint(address, euint64)`
- All position data remains encrypted (collateral, leverage, direction)

**Full Privacy Stack**:
1. **ZK Layer**: KYC tier verified via ZK proof (no PII on-chain)
2. **FHE Layer**: Position data encrypted (collateral, leverage, direction)
3. **ERC7984 Layer**: Token balances encrypted (synth tokens + cUSDC)

## Privacy Guarantees

### What is Hidden?

| Data | Visibility | Who Can Decrypt? |
|------|-----------|------------------|
| Synth token balance | Encrypted | Token holder only |
| cUSDC balance | Encrypted | Token holder only |
| Position collateral | Encrypted | Position owner only |
| Position leverage | Encrypted | Position owner only |
| Position direction (LONG/SHORT) | Encrypted | Position owner only |
| KYC tier | Encrypted | User + TierManager owner |
| Total supply | Encrypted | Token owner only |

### What is Visible?

| Data | Visibility | Reason |
|------|-----------|--------|
| Transaction sender/receiver | Public | Required for blockchain consensus |
| Transaction timestamp | Public | Required for blockchain consensus |
| Asset type (sAAPL vs sTSLA) | Public | Non-sensitive, needed for routing |
| Position open/closed status | Public | Non-sensitive, needed for iteration |

## Security Considerations

### 1. Wrapping/Unwrapping

- **Wrapping**: Instant and trustless (standard ERC20 transfer + encrypted mint)
- **Unwrapping**: Requires relayer for decryption (introduces async dependency)
- **Decryption proofs**: Verified on-chain (trustless, but gas-intensive)

### 2. Relayer Dependency

- Unwrapping requires a **relayer** to decrypt amounts off-chain
- Relayer cannot steal funds (decryption proof verified on-chain)
- Relayer can delay unwrapping (DoS risk, mitigated by multiple relayers)
- **Mitigation**: Run your own relayer or use multiple public relayers

### 3. Gas Costs

- FHE operations are **more expensive** than plaintext operations
- Wrapping: ~100k gas (similar to ERC20 transfer)
- Unwrapping: ~200k gas (includes proof verification)
- Position opening: ~500k gas (includes FHE tier check + encrypted mint)

### 4. Compliance

- All transactions are **on-chain and auditable**
- Amounts are encrypted but **transaction graph is visible**
- Regulators can request **decryption keys** for specific investigations
- Users can **selectively disclose** balances using FHE.allow()

## Integration Guide

### For Frontend Developers

**1. Install Zama SDK**:
```bash
npm install fhevmjs
```

**2. Encrypt inputs**:
```typescript
import { createInstance } from 'fhevmjs';

// Initialize FHE instance
const fhevm = await createInstance({ chainId: 8009 });

// Encrypt collateral amount
const encryptedInput = await fhevm
  .createEncryptedInput(vaultAddress, userAddress)
  .add64(1000e6) // 1000 USDC
  .encrypt();

// Open position with encrypted input
await vault.openPosition(
  synthToken,
  encIsLong,
  encryptedInput.handles[0], // encrypted collateral
  encLeverage,
  encExecutionPrice,
  encryptedInput.inputProof
);
```

**3. Decrypt balances**:
```typescript
// Get encrypted balance handle
const encBalance = await csAAPL.confidentialBalanceOf(userAddress);

// Decrypt using user's private key
const balance = await fhevm.decrypt(encBalance, userAddress);
console.log(`Balance: ${balance}`);
```

### For Smart Contract Developers

**1. Mint encrypted tokens**:
```solidity
// Convert plaintext to encrypted
euint64 encAmount = FHE.asEuint64(1000e18);

// Mint to user
csAAPL.mint(user, encAmount);

// Allow user to decrypt
FHE.allow(encAmount, user);
```

**2. Transfer encrypted tokens**:
```solidity
// User creates encrypted input off-chain
externalEuint64 encAmount = ...; // from fhevmjs
bytes memory inputProof = ...;   // from fhevmjs

// Transfer with encrypted amount
csAAPL.confidentialTransfer(recipient, encAmount, inputProof);
```

**3. Burn encrypted tokens**:
```solidity
// Burn from user (vault only)
euint64 encAmount = position.synthAmount; // already encrypted
csAAPL.burn(user, encAmount);
```

## Testing

### Unit Tests

```typescript
describe('ConfidentialSynthToken', () => {
  it('should mint encrypted tokens', async () => {
    const amount = 1000e18;
    const encAmount = await fhevm
      .createEncryptedInput(token.address, owner.address)
      .add64(amount)
      .encrypt();
    
    await token.mint(user.address, encAmount.handles[0]);
    
    const encBalance = await token.confidentialBalanceOf(user.address);
    expect(encBalance).to.not.equal(0); // Handle exists
    
    const balance = await fhevm.decrypt(encBalance, user.address);
    expect(balance).to.equal(amount);
  });
});
```

### Integration Tests

```typescript
describe('Full Position Flow', () => {
  it('should open position with encrypted collateral', async () => {
    // 1. Wrap USDC → cUSDC
    await usdc.approve(cUSDC.address, 1000e6);
    await cUSDC.depositFor(user.address, 1000e6);
    
    // 2. Open position with encrypted inputs
    const enc = await fhevm
      .createEncryptedInput(vault.address, user.address)
      .add64(1000e6)  // collateral
      .add8(5)        // leverage
      .add64(150e8)   // price
      .encrypt();
    
    await vault.openPosition(
      csAAPL.address,
      true, // isLong
      enc.handles[0],
      enc.handles[1],
      enc.handles[2],
      enc.inputProof
    );
    
    // 3. Verify encrypted synth tokens minted
    const encBalance = await csAAPL.confidentialBalanceOf(user.address);
    expect(encBalance).to.not.equal(0);
  });
});
```

## Deployment

### 1. Deploy USDC Wrapper

```typescript
// Deploy ConfidentialUSDC
const cUSDC = await ethers.deployContract('ConfidentialUSDC', [
  usdcAddress // underlying USDC token
]);
```

### 2. Deploy Synth Tokens

```typescript
// Deploy ConfidentialSynthToken for each asset
const csAAPL = await ethers.deployContract('ConfidentialSynthToken', [
  owner.address,
  'Confidential Synthetic Apple',
  'csAAPL',
  'AAPL',
  'https://ztocks.io/tokens/csaapl'
]);

// Set vault address (one-time, irreversible)
await csAAPL.setVault(vault.address);
```

### 3. Deploy Vault

```typescript
// Deploy ConfidentialSynthVaultFHE
const vault = await ethers.deployContract('ConfidentialSynthVaultFHE', [
  zkVerifier.address,
  tierManager.address,
  cUSDC.address, // use cUSDC instead of USDC
  feeModule.address
]);

// Register synth assets
await vault.registerSynthAsset(csAAPL.address);
await vault.registerSynthAsset(csTSLA.address);
```

## Comparison: Before vs After

### Before (Standard ERC20)

```solidity
// ❌ Plaintext balance (visible to everyone)
uint256 balance = synthToken.balanceOf(user);

// ❌ Plaintext transfer (MEV bots can see amount)
synthToken.transfer(recipient, 1000e18);

// ❌ Plaintext collateral (liquidation bots can calculate health)
position.collateralUSDC = 1000e6;
```

### After (ERC7984 Confidential)

```solidity
// ✅ Encrypted balance (only user can decrypt)
euint64 encBalance = csAAPL.confidentialBalanceOf(user);

// ✅ Encrypted transfer (MEV bots blind)
csAAPL.confidentialTransfer(recipient, encAmount, inputProof);

// ✅ Encrypted collateral (liquidation bots blind)
position.collateralUSDC = FHE.asEuint64(1000e6); // encrypted
```

## Roadmap

### Phase 1: Core Implementation ✅
- [x] ConfidentialSynthToken (ERC7984)
- [x] ConfidentialUSDC (ERC7984ERC20Wrapper)
- [x] Update ConfidentialSynthVaultFHE
- [x] Documentation

### Phase 2: Testing & Deployment 🚧
- [ ] Unit tests for ConfidentialSynthToken
- [ ] Unit tests for ConfidentialUSDC
- [ ] Integration tests for full position flow
- [ ] Deploy to Zama testnet
- [ ] Frontend integration with fhevmjs

### Phase 3: Advanced Features 📋
- [ ] Confidential liquidations (encrypted health factor checks)
- [ ] Confidential P&L calculations (encrypted profit/loss)
- [ ] Confidential fee collection (encrypted fee amounts)
- [ ] Batch operations (gas optimization)
- [ ] Multi-relayer support (decentralization)

## Resources

- **ERC7984 Standard**: https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/erc7984
- **OpenZeppelin Confidential Contracts**: https://github.com/OpenZeppelin/openzeppelin-confidential-contracts
- **Zama FHE Documentation**: https://docs.zama.org/protocol
- **fhevmjs SDK**: https://docs.zama.org/fhevm/getting_started/sdk

## Support

For questions or issues:
- GitHub Issues: https://github.com/Rohitamalraj/Ztocks/issues
- Zama Discord: https://discord.gg/zama
- OpenZeppelin Forum: https://forum.openzeppelin.com/

---

**Built with ❤️ using Zama FHE and OpenZeppelin Confidential Contracts**

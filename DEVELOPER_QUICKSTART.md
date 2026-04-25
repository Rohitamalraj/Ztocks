# Developer Quickstart: ERC7984 Integration

## 🚀 Quick Start

This guide helps you get started with Ztocks' ERC7984 confidential tokens in 5 minutes.

## 📦 Installation

```bash
# Clone the repo
git clone https://github.com/Rohitamalraj/Ztocks.git
cd Ztocks/contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Ztocks Privacy Stack                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: ZK Proofs (Identity Privacy)                      │
│  └─ ZKVerifier: Verify KYC tier without revealing PII       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: FHE (Position Privacy)                            │
│  └─ ConfidentialTierManager: Encrypted tier storage         │
│  └─ ConfidentialSynthVaultFHE: Encrypted positions          │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: ERC7984 (Balance Privacy)                         │
│  └─ ConfidentialSynthToken: Encrypted synth balances        │
│  └─ ConfidentialUSDC: Encrypted collateral balances         │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 Key Contracts

### 1. ConfidentialSynthToken (csAAPL, csTSLA, etc.)

**What**: ERC7984 confidential synthetic equity tokens  
**Privacy**: Encrypted balances, encrypted transfers  
**Use Case**: Hold synthetic positions without revealing size

```solidity
// Deploy
ConfidentialSynthToken csAAPL = new ConfidentialSynthToken(
    owner,
    "Confidential Synthetic Apple",
    "csAAPL",
    "AAPL",
    "https://ztocks.io/tokens/csaapl"
);

// Set vault (one-time)
csAAPL.setVault(vaultAddress);

// Mint (vault only)
euint64 encAmount = FHE.asEuint64(1000e18);
csAAPL.mint(user, encAmount);

// Transfer (user)
csAAPL.confidentialTransfer(recipient, encAmount, inputProof);
```

### 2. ConfidentialUSDC (cUSDC)

**What**: ERC7984 wrapper for USDC  
**Privacy**: Encrypted collateral deposits  
**Use Case**: Deposit collateral without revealing amount

```solidity
// Deploy
ConfidentialUSDC cUSDC = new ConfidentialUSDC(usdcAddress);

// Wrap USDC → cUSDC (instant)
usdc.approve(address(cUSDC), 1000e6);
cUSDC.depositFor(msg.sender, 1000e6);

// Unwrap cUSDC → USDC (2-step async)
// Step 1: Request
cUSDC.unwrap(user, user, encAmount, inputProof);
// Step 2: Finalize (after relayer decrypts)
cUSDC.finalizeUnwrap(requestId, cleartextAmount, decryptionProof);
```

### 3. ConfidentialSynthVaultFHE

**What**: Core vault for leveraged synthetic positions  
**Privacy**: Encrypted collateral, leverage, direction  
**Use Case**: Open positions without revealing strategy

```solidity
// Open position with encrypted inputs
vault.openPosition(
    csAAPL,           // synth token
    encIsLong,        // encrypted direction
    encCollateral,    // encrypted collateral
    encLeverage,      // encrypted leverage
    encPrice,         // encrypted price
    inputProof        // proof
);
```

## 💻 Frontend Integration

### Setup fhevmjs

```typescript
import { createInstance } from 'fhevmjs';

// Initialize FHE instance
const fhevm = await createInstance({ 
  chainId: 8009,  // Zama testnet
  publicKey: await provider.call({ 
    to: FHE_LIB_ADDRESS, 
    data: '0x...' 
  })
});
```

### Encrypt Inputs

```typescript
// Create encrypted input
const encryptedInput = await fhevm
  .createEncryptedInput(contractAddress, userAddress)
  .add64(1000e6)  // collateral
  .add8(5)        // leverage
  .add64(150e8)   // price
  .encrypt();

// Use in transaction
await vault.openPosition(
  synthToken,
  true,  // isLong
  encryptedInput.handles[0],  // collateral
  encryptedInput.handles[1],  // leverage
  encryptedInput.handles[2],  // price
  encryptedInput.inputProof
);
```

### Decrypt Balances

```typescript
// Get encrypted balance handle
const encBalance = await csAAPL.confidentialBalanceOf(userAddress);

// Decrypt using user's private key
const balance = await fhevm.decrypt(encBalance, userAddress);
console.log(`Balance: ${balance}`);
```

## 🧪 Testing

### Unit Tests (No FHE Required)

```typescript
describe("ConfidentialSynthToken", () => {
  it("should deploy correctly", async () => {
    const token = await ethers.deployContract("ConfidentialSynthToken", [
      owner.address,
      "Confidential Synthetic Apple",
      "csAAPL",
      "AAPL",
      "https://ztocks.io/tokens/csaapl"
    ]);
    
    expect(await token.name()).to.equal("Confidential Synthetic Apple");
    expect(await token.symbol()).to.equal("csAAPL");
  });
});
```

### Integration Tests (FHE Required)

```typescript
describe("Full Position Flow", () => {
  let fhevm: any;
  
  before(async () => {
    fhevm = await createInstance({ chainId: 31337 });
  });
  
  it("should open encrypted position", async () => {
    // Wrap USDC
    await usdc.approve(cUSDC.address, 1000e6);
    await cUSDC.depositFor(user.address, 1000e6);
    
    // Create encrypted inputs
    const enc = await fhevm
      .createEncryptedInput(vault.address, user.address)
      .add64(1000e6)  // collateral
      .add8(5)        // leverage
      .add64(150e8)   // price
      .encrypt();
    
    // Open position
    await vault.openPosition(
      csAAPL.address,
      true,
      enc.handles[0],
      enc.handles[1],
      enc.handles[2],
      enc.inputProof
    );
    
    // Verify encrypted balance
    const encBalance = await csAAPL.confidentialBalanceOf(user.address);
    expect(encBalance).to.not.equal(0);
  });
});
```

## 🚀 Deployment

### Local Testnet

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deployERC7984.ts --network localhost
```

### Zama Testnet

```bash
# Set environment variables
export PRIVATE_KEY="0x..."
export USDC_ADDRESS="0x..."

# Deploy
npx hardhat run scripts/deployERC7984.ts --network sepolia
```

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia \
  <CONTRACT_ADDRESS> \
  "<CONSTRUCTOR_ARG_1>" \
  "<CONSTRUCTOR_ARG_2>"
```

## 📊 Common Patterns

### Pattern 1: Wrap → Deposit → Trade

```typescript
// 1. Wrap USDC → cUSDC
await usdc.approve(cUSDC.address, amount);
await cUSDC.depositFor(user.address, amount);

// 2. Create encrypted inputs
const enc = await fhevm
  .createEncryptedInput(vault.address, user.address)
  .add64(collateral)
  .add8(leverage)
  .add64(price)
  .encrypt();

// 3. Open position
await vault.openPosition(
  synthToken,
  isLong,
  enc.handles[0],
  enc.handles[1],
  enc.handles[2],
  enc.inputProof
);
```

### Pattern 2: Close → Unwrap → Withdraw

```typescript
// 1. Close position
await vault.closePosition(positionId, currentPrice);

// 2. Unwrap cUSDC → USDC (request)
const enc = await fhevm
  .createEncryptedInput(cUSDC.address, user.address)
  .add64(amount)
  .encrypt();
await cUSDC.unwrap(user, user, enc.handles[0], enc.inputProof);

// 3. Wait for relayer to decrypt
// (Monitor UnwrapRequested event)

// 4. Finalize unwrap
await cUSDC.finalizeUnwrap(requestId, cleartextAmount, proof);
```

### Pattern 3: Check Balance (Encrypted)

```typescript
// Get encrypted balance handle
const encBalance = await csAAPL.confidentialBalanceOf(user);

// Decrypt locally (user only)
const balance = await fhevm.decrypt(encBalance, user);

// Display to user
console.log(`Your csAAPL balance: ${ethers.formatEther(balance)}`);
```

## 🔧 Troubleshooting

### Issue: "Invalid BytesLike value"
**Cause**: Trying to pass plaintext value as encrypted parameter  
**Fix**: Use fhevmjs to create encrypted inputs

```typescript
// ❌ Wrong
await token.mint(user, 1000);

// ✅ Correct
const enc = await fhevm.createEncryptedInput(token.address, user)
  .add64(1000)
  .encrypt();
await token.mint(user, enc.handles[0]);
```

### Issue: "OnlyVault" error
**Cause**: Trying to mint/burn from non-vault address  
**Fix**: Set vault address first

```solidity
// Set vault (owner only, one-time)
await csAAPL.setVault(vault.address);
```

### Issue: Compilation fails with "pragma mismatch"
**Cause**: ERC7984 requires Solidity ^0.8.27  
**Fix**: Update hardhat.config.ts

```typescript
solidity: {
  compilers: [
    { version: "0.8.27", settings: { optimizer: { enabled: true }, viaIR: true } }
  ]
}
```

### Issue: "Stack too deep" error
**Cause**: Complex FHE operations exceed stack limit  
**Fix**: Enable viaIR in hardhat config

```typescript
settings: { 
  optimizer: { enabled: true, runs: 200 }, 
  viaIR: true  // ← Add this
}
```

## 📚 Resources

### Documentation
- [ERC7984 Integration Guide](./ERC7984_INTEGRATION.md) - Comprehensive guide
- [Implementation Summary](./ERC7984_IMPLEMENTATION_SUMMARY.md) - What was built
- [Zama Docs](https://docs.zama.org/protocol) - FHE documentation
- [OpenZeppelin Docs](https://docs.openzeppelin.com/) - Contract standards

### Code Examples
- [ConfidentialSynthToken.sol](./contracts/contracts/ConfidentialSynthToken.sol)
- [ConfidentialUSDC.sol](./contracts/contracts/ConfidentialUSDC.sol)
- [ConfidentialSynthVaultFHE.sol](./contracts/contracts/ConfidentialSynthVaultFHE.sol)
- [Test Suite](./contracts/test/ConfidentialSynthToken.test.ts)

### Tools
- [fhevmjs SDK](https://www.npmjs.com/package/fhevmjs) - Frontend encryption
- [Hardhat](https://hardhat.org/) - Development environment
- [Ethers.js](https://docs.ethers.org/) - Ethereum library

## 🎯 Quick Commands

```bash
# Compile
npm run compile

# Test
npm test

# Deploy locally
npx hardhat run scripts/deployERC7984.ts --network localhost

# Deploy to testnet
npx hardhat run scripts/deployERC7984.ts --network sepolia

# Verify contract
npx hardhat verify --network sepolia <ADDRESS> <ARGS>

# Start local node
npx hardhat node

# Console
npx hardhat console --network localhost
```

## 💡 Tips

1. **Always encrypt inputs**: Never pass plaintext values to FHE functions
2. **Use fhevmjs**: Required for creating encrypted inputs and decrypting outputs
3. **Set vault once**: `setVault()` is irreversible, double-check the address
4. **Monitor events**: Watch for `UnwrapRequested` to finalize unwraps
5. **Test locally first**: Use Hardhat network before deploying to testnet
6. **Enable viaIR**: Required for FHE contracts to compile
7. **Batch operations**: Reduce gas costs by batching multiple operations

## 🤝 Support

- **GitHub Issues**: https://github.com/Rohitamalraj/Ztocks/issues
- **Zama Discord**: https://discord.gg/zama
- **OpenZeppelin Forum**: https://forum.openzeppelin.com/

---

**Happy Building! 🚀**

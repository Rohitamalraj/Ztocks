# Ztocks - Confidential Synthetic Trading Protocol

> A privacy-preserving synthetic stock trading protocol combining Zero-Knowledge proofs with Fully Homomorphic Encryption on Zama Protocol.

## 🎯 Overview

Ztocks enables confidential trading of synthetic stocks (sAAPL, sTSLA, etc.) with:
- **ZK Identity Layer**: Verify KYC tier without revealing personal data
- **FHE Position Layer**: Encrypt collateral, leverage, and direction on-chain
- **Tier-Based Leverage**: Enforce compliance rules on encrypted data
- **MEV Protection**: Position parameters hidden from validators and bots

## 🏗️ Architecture

```
┌─────────────────── ZK Identity Layer ──────────────────┐
│  Circom circuit verifies KYC tier via Groth16 proofs   │
│  No personal data on-chain, only tier (1-4)            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────── FHE Encryption Layer ───────────────┐
│  Tier encrypted as euint8 in ConfidentialTierManager   │
│  Positions encrypted as euint64/ebool in Vault         │
│  Leverage enforcement on ciphertext using FHE ops      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────── Smart Contracts ────────────────────┐
│  ConfidentialSynthVaultFHE: FHE-encrypted trading      │
│  ConfidentialTierManager: Encrypted tier storage       │
│  ZKVerifier: Groth16 proof verification                │
└─────────────────────────────────────────────────────────┘
```

## 📦 Project Structure

```
Ztocks/
├── contracts/          # Solidity smart contracts (Hardhat)
│   ├── contracts/      # Contract source files
│   ├── scripts/        # Deployment scripts
│   └── test/           # Contract tests
├── circuits/           # Circom ZK circuits
│   ├── tier_proof.circom
│   └── scripts/        # Circuit compilation
├── frontend/           # Next.js 16 trading interface
│   ├── app/            # Next.js app directory
│   ├── components/     # React components
│   └── hooks/          # Custom React hooks
└── backend/            # Express.js backend services
    ├── src/routes/     # API routes (KYC, prices)
    └── src/lib/        # Utilities
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Install all dependencies
npm install

# Contracts
cd contracts && npm install

# Frontend
cd frontend && npm install

# Backend
cd backend && npm install

# Circuits
cd circuits && npm install
```

### Development

```bash
# Compile contracts
cd contracts && npx hardhat compile

# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev
```

## 🔑 Key Features

### 1. Zero-Knowledge Identity
- Circom circuit for tier verification
- Groth16 proofs generated client-side
- No PII stored on-chain
- Credit score-based tier assignment

### 2. Fully Homomorphic Encryption
- Position data encrypted with Zama FHE
- Leverage enforcement on ciphertext
- `FHE.eq()`, `FHE.le()`, `FHE.mul()` operations
- MEV-resistant trading

### 3. Tier-Based Leverage
| Tier | Description | Max Leverage |
|------|-------------|--------------|
| 1 | Basic KYC | 2x |
| 2 | Accredited Investor | 5x |
| 3 | High Net Worth | 8x |
| 4 | Institutional / QIB | 10x |

### 4. Synthetic Assets
- sAAPL, sTSLA, sNVDA, sSPY, sAMZN, sMSFT, sMETA, sNFLX, sAMD
- Real-time price feeds (Finnhub + Bybit)
- Long/Short positions
- Automated liquidations

## 🛠️ Technology Stack

- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **FHE**: Zama Protocol (@fhevm/solidity)
- **ZK Proofs**: Circom, snarkjs, Groth16
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Web3**: Wagmi 2.x, RainbowKit, Viem
- **Backend**: Express.js, TypeScript
- **Network**: Sepolia Testnet

## 📝 Smart Contracts

### Core Contracts
- `ConfidentialSynthVaultFHE.sol` - FHE-encrypted trading vault
- `ConfidentialTierManager.sol` - Encrypted tier management
- `ZKVerifier.sol` - Groth16 proof verification
- `SynthToken.sol` - ERC-20 synthetic assets
- `FeeModule.sol` - Protocol fee collection

### Deployment
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network sepolia
```

## 🎨 Frontend

Built with Next.js 16 and React 19:
- Trading terminal with live charts
- Portfolio management
- ZK proof generation UI
- Wallet integration (RainbowKit)
- Real-time price feeds

## 🔐 Security

- ZK proofs prevent identity leakage
- FHE encryption hides position data
- Reentrancy guards on all state changes
- Pausable contracts for emergencies
- Tier-based access control

## 📚 Documentation

- [Contracts README](./contracts/README.md)
- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
- [Circuits README](./circuits/README.md)

## 🤝 Contributing

This project was built for the Zama Hackathon 2026.

## 📄 License

MIT

## 🔗 Links

- **GitHub**: https://github.com/Rohitamalraj/Ztocks
- **Zama Protocol**: https://docs.zama.ai/protocol/

---

**Built with ❤️ for the Zama Hackathon 2026**

# Ztocks

Confidential synthetic stock trading built on Zama Protocol.

`Ztocks` is a full-stack dApp where collateral, leverage, and position data remain encrypted on-chain using FHE, while compliance rules (tier-gated leverage) are still enforced on encrypted state.

## Problem

Public blockchains expose position metadata by default. In leveraged trading, this creates two major failures:

- Execution alpha leaks: pending trades and sizes are visible to counterparties and bots.
- MEV extraction: public parameters enable front-running, sandwiching, and liquidation targeting.
- Institutional friction: compliance and confidentiality requirements are hard to satisfy simultaneously on transparent ledgers.

This project targets that gap by combining:

- ZK proofs for private identity/tier attestation.
- FHE for encrypted on-chain trading state and logic.
- ERC7984 confidential token flows for private balances.

## Why Now (Market Context)

- DeFi market size in 2026: **$238.54B**, projected **$770.56B by 2031** (26.43% CAGR).  
  Source: [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/decentralized-finance-defi-market)
- DeFi TVL in Q1 2026: **$185B**, users: **8.2M**, institutional share: **34%**.  
  Source: [Resh Network](https://www.resh.network/blog/defi-state-of-market-2026)
- Institutional operational crypto adoption remains around **40%**, with privacy/confidentiality repeatedly cited as a blocker.  
  Source: [Retail Banker International](https://www.retailbankerinternational.com/news/institutional-crypto-adoption-flat-in-2025-globaldata/)
- Ethereum users have lost **$1.3B+** to MEV-style extraction patterns.  
  Source: [Digitap](https://digitap.app/news/guide/what-is-mev-how-it-impacts-traders-networks-in-2025)

## Solution Overview

`Ztocks` enforces leverage policy and position mechanics while core trading values stay encrypted:

- Collateral: encrypted (`euint64` flow via confidential wrapper + vault logic)
- Leverage: encrypted (`euint8`)
- Direction: encrypted (`ebool`)
- Tier checks: enforced in `ConfidentialTierManager` using FHE operations

Compliance is preserved without exposing user financial intent in plaintext.

## Architecture

```
┌────────────────────────── User / Frontend ──────────────────────────┐
│ Next.js app encrypts trade inputs client-side (fhevmjs)             │
│ Generates Groth16 proof for KYC tier attestation (snarkjs + circom) │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────── On-chain Layer ──────────────────────────┐
│ ZKVerifier.sol                                                       │
│   - verifies Groth16 proof                                           │
│   - writes verified tier + expiry                                    │
│                                                                      │
│ ConfidentialTierManager.sol                                          │
│   - stores encrypted tier state                                      │
│   - checks leverage cap against encrypted leverage                   │
│                                                                      │
│ ConfidentialSynthVaultFHE.sol                                        │
│   - opens/closes encrypted positions                                 │
│   - pulls confidential collateral                                    │
│   - mints/burns confidential synths                                  │
│                                                                      │
│ ConfidentialUSDC.sol + ConfidentialSynthToken.sol (ERC7984)          │
│   - confidential wrapper + confidential synth balances               │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────── Zama Relayer ────────────────────────────┐
│ Handles public decryption flow for wrapper unwrap finalization       │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Features

- Fully encrypted position state on-chain.
- Tier-gated leverage enforcement over encrypted values.
- Confidential collateral with ERC7984 wrapper flow.
- Client-side proof generation for KYC tier registration.
- Full trade lifecycle UI: verify -> trade -> close -> unwrap.

## Contracts

Located in `contracts/contracts/`:

- `ConfidentialSynthVaultFHE.sol` - core confidential trading vault.
- `ConfidentialTierManager.sol` - encrypted tier storage and leverage checks.
- `ZKVerifier.sol` - Groth16 proof verification and tier registration.
- `Groth16Verifier.sol` - generated verifier from current circuit/zkey.
- `ConfidentialUSDC.sol` - ERC7984 confidential wrapper for USDC.
- `ConfidentialSynthToken.sol` - confidential synth token per asset.

## ZK Circuit

Located in `circuits/`:

- `tier_proof.circom`
- `scripts/setup.ps1` (compile + setup + verifier/artifact export)

Important:

- Regenerating circuit artifacts changes verifier compatibility.
- If you re-run circuit setup, redeploy `Groth16Verifier` + `ZKVerifier` and sync addresses.

## Frontend + Backend

- Frontend: `frontend/` (Next.js 16, React 19, wagmi, RainbowKit, viem).
- Backend: `backend/` (Express + TypeScript) for KYC credential issuance and market utilities.
- Relayer public decrypt endpoint: `frontend/app/api/fhe/public-decrypt/route.ts`.

## Tech Stack

- Solidity 0.8.x + Hardhat
- Zama `@fhevm/solidity`
- OpenZeppelin `@openzeppelin/confidential-contracts` (ERC7984)
- Circom + snarkjs (Groth16)
- Next.js 16 + React 19
- wagmi + viem + RainbowKit
- Express.js + TypeScript

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- MetaMask (Sepolia)

### Install

```bash
cd contracts && npm install
cd ../frontend && npm install
cd ../backend && npm install
cd ../circuits && npm install
```

### Environment

- Copy `.env.example` in each package.
- Ensure oracle keypair is consistent between:
  - `contracts/.env` (`ORACLE_PUBKEY_AX`, `ORACLE_PUBKEY_AY`)
  - `backend/.env` (`ORACLE_PRIVATE_KEY`)
- Use the latest deployed Sepolia addresses from:
  - `contracts/deployments/sepolia.json`
  - `frontend/.env.local` or `frontend/lib/sepolia-defaults.json`

### Run

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Deployment (Sepolia)

```bash
cd contracts
npm run deploy:sepolia
```

Then sync emitted addresses to frontend config/env.

## End-to-End Test Flow

Use `TESTING_CHECKLIST.md`, or execute:

1. Connect wallet on Sepolia.
2. Verify identity (ZK proof submission).
3. Open encrypted position from Trade page.
4. Close position from Portfolio page.
5. Withdraw USDC from cUSDC via unwrap + finalize flow.

## Repository Notes

- `frontend/public/circuits/*.wasm` and `*.zkey` are intentionally committed for browser proof generation.
- `frontend/public/tfhe_bg.wasm` is required runtime asset for FHE browser initialization.
- Never commit `.env`, `.env.local`, or private keys.

## Documentation

- `contracts/README.md`
- `frontend/README.md`
- `backend/README.md`
- `circuits/README.md`
- `TESTING_CHECKLIST.md`

## License

MIT

# Ztocks — FHE-Encrypted Synthetic Stock Trading on Zama Protocol

Build a confidential synthetic stock trading dApp where collateral, leverage, and position size are **encrypted at all times** using Zama's FHE — with compliance rules enforced on ciphertext.

## Architecture Overview

```
Legacy app (source)                 →  Ztocks (target)
─────────────────                      ────────────────
HashKey Chain Testnet (ID: 133)     →  Sepolia Testnet (ID: 11155111)
ZK Proofs (Circom/Groth16)          →  ZK tier proof retained for leverage gating
Baby Jubjub EdDSA signing           →  Baby Jubjub signing retained (tier credential issuer)
Public collateral/leverage          →  Tier-gated leverage + FHE-ready confidential position model
SynthVault + ZKVerifier             →  ConfidentialSynthVault + ZKVerifier + ConfidentialTierManager
Backend KYC oracle                  →  Backend KYC oracle on Sepolia (credential signer)
Same frontend design/CSS/UX        →  Same frontend design/CSS/UX
```

## User Review Required

> [!IMPORTANT]
> **Network Choice**: We're deploying on **Sepolia Testnet** with Zama's fhEVM coprocessor. This means contracts must inherit from `SepoliaZamaFHEVMConfig` and use `fhevm` Solidity library.

> [!IMPORTANT]
> **Hybrid ZK + FHE Stack**: Ztocks keeps the `circuits/` folder and `ZKVerifier` flow because zk identity decides leverage caps. FHE remains the confidentiality layer for position data as we migrate to full fhEVM encrypted types.

> [!WARNING]
> **Contract Differences from prior baseline**: Ztocks keeps zk-based identity verification for eligibility and leverage enforcement, while evolving vault logic toward fhEVM encrypted state. The current Sepolia contracts are FHE-ready and preserve the same leverage-by-tier invariant.

## Open Questions

> [!IMPORTANT]
> 1. **Deployer Wallet**: Do you have a wallet with Sepolia ETH loaded? We'll need it for deploying contracts. If not, we can set up a faucet flow.
> 2. **WalletConnect Project ID**: Should I reuse the same WalletConnect project ID `9faa374ae697bf8830e16c49cd631805`, or do you have a new one for Ztocks?
> 3. **Finnhub API Key**: Should I reuse the same Finnhub key for price feeds?
> 4. **Infura API Key**: For Sepolia RPC, do you have an Infura key, or should we use a public RPC like `https://rpc.sepolia.org`?

---

## Proposed Changes

### Project Structure

```
D:\Projects\Ztocks\
├── contracts/                     # Hardhat + fhEVM contracts (Sepolia)
│   ├── contracts/                 # Solidity source (fhEVM convention: /contracts/)
│   │   ├── ConfidentialTierManager.sol
│   │   ├── ConfidentialSynthVault.sol
│   │   ├── ConfidentialLiquidation.sol
│   │   ├── SynthToken.sol
│   │   ├── MockUSDC.sol
│   │   └── MockFeeToken.sol
│   ├── deploy/                    # Deploy scripts (fhEVM template style)
│   ├── test/                      # Contract tests
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env
│
├── frontend/                      # Next.js 16 frontend
│   ├── app/
│   │   ├── globals.css            # Project CSS
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing page
│   │   ├── providers.tsx
│   │   ├── trade/page.tsx         # Trading terminal
│   │   ├── portfolio/page.tsx
│   │   └── api/                   # Next.js API routes
│   ├── components/
│   │   ├── app/                   # App-level components
│   │   ├── dashboard/             # Trading UI components
│   │   ├── landing/               # Landing page sections
│   │   └── ui/                    # Reusable UI primitives
│   ├── hooks/                     # React hooks
│   ├── lib/                       # Utilities & configs
│   ├── types/
│   ├── package.json
│   └── .env.local
│
├── backend/                       # Express.js backend (price oracle + KYC)
│   ├── src/
│   │   ├── index.ts
│   │   ├── lib/chainClients.ts
│   │   └── routes/
│   │       ├── kyc.ts
│   │       └── price.ts
│   ├── package.json
│   └── .env
│
├── README.md
└── .gitignore
```

---

### Smart Contracts (Zama fhEVM on Sepolia)

The core innovation: contracts use **TFHE encrypted types** so position data stays encrypted on-chain.

#### [NEW] ConfidentialTierManager.sol

Stores each user's accreditation tier as an **encrypted** value (`euint8`). Only the user can decrypt their own tier.

```solidity
// Key design:
// - Owner (KYC oracle) sets encrypted tiers via TFHE.asEuint8()
// - Leverage caps are checked via TFHE.le() on encrypted data
// - Nobody sees the user's tier — not even validators
contract ConfidentialTierManager is SepoliaZamaFHEVMConfig, Ownable2Step {
    mapping(address => euint8) private encryptedTier;
    mapping(uint8 => uint8) public maxLeverage; // tier => max leverage (plaintext config)
    
    function setTier(address user, einput encTier, bytes calldata inputProof) external onlyOwner;
    function checkLeverage(address user, euint8 requestedLeverage) external view returns (ebool);
}
```

#### [NEW] ConfidentialSynthVault.sol

Core vault where **collateral, leverage, and position size are all encrypted**.

```solidity
contract ConfidentialSynthVault is SepoliaZamaFHEVMConfig, Ownable2Step, ReentrancyGuard {
    struct EncryptedPosition {
        address asset;
        ebool   isLong;
        euint64 collateralUSDC;    // encrypted collateral
        euint8  leverage;          // encrypted leverage
        euint64 entryPrice;        // encrypted entry price
        euint64 synthAmount;       // encrypted synth amount
        uint256 openTime;          // plaintext timestamp (non-sensitive)
        bool    isOpen;            // plaintext (needed for iteration)
    }
    
    // Leverage enforcement on ciphertext:
    // TFHE.le(requestedLeverage, tierCap) — contract never sees either value
    function openPosition(
        address synthToken,
        einput encIsLong,
        einput encCollateral, 
        einput encLeverage,
        einput encExecutionPrice,
        bytes calldata inputProof
    ) external;
}
```

#### [NEW] ConfidentialLiquidation.sol

Liquidation logic that checks health factor on encrypted data.

```solidity
// Health factor computed on encrypted values:
// ebool isLiquidatable = TFHE.lt(healthFactor, LIQUIDATION_THRESHOLD);
```

#### [REUSE] SynthToken.sol

Same ERC-20 synth token design — mint/burn restricted to vault.

#### [REUSE] MockUSDC.sol / MockFeeToken.sol

Same mock tokens for testnet, with faucet function.

---

### Frontend (Next.js 16)

#### Design System — Exact Copy

- **`globals.css`** — Copy verbatim from the prior build (Tailwind v4 + tw-animate-css + all custom utilities)
- **`layout.tsx`** — Same Figtree + Geist Mono fonts, same structure
- **UI Components** — All 13 UI primitives copied: button, input, label, badge, dialog, drawer, select, separator, slider, alert, bottom-sheet, leverage-slider, token-logo
- **Landing Components** — All 13 landing sections adapted for Ztocks branding

#### Key Differences from prior frontend

| Area | Prior build | Ztocks |
|------|---------|--------|
| Chain | HashKey Testnet (133) | Sepolia (11155111) |
| Identity | ZK proof generation (snarkjs) | FHE tier encryption (Zama SDK) |
| Verify modal | Circom proof flow | Oracle-set encrypted tier flow |
| Hooks | `use-zk-identity.ts` | `use-fhe-identity.ts` |
| Wagmi config | HashKey chain def | Sepolia chain def |
| Branding | prior naming | "Ztocks" |
| Landing copy | ZK-focused messaging | FHE-focused messaging |

#### [NEW] Frontend Files

- `lib/wagmi.ts` — Sepolia chain definition
- `lib/contracts.ts` — Ztocks contract addresses on Sepolia
- `lib/abis.ts` — FHE-compatible ABIs
- `hooks/use-fhe-identity.ts` — FHE identity verification hook
- `hooks/use-vault.ts` — Adapted for FHE encrypted inputs
- `components/dashboard/verify-identity-modal.tsx` — FHE flow instead of ZK

#### [COPY] Frontend Files (from prior build, adapted)

All remaining components, hooks, and lib files — with branding and chain references updated.

---

### Backend (Express.js — Price Oracle + KYC)

Nearly identical to the prior backend, with these changes:

| Area | Prior build | Ztocks |
|------|---------|--------|
| Chain client | HashKey Testnet RPC | Sepolia RPC |
| KYC route | Returns signed credential for ZK | Returns tier assessment (oracle sets on-chain) |
| Credit scoring | Reads HSK balance + USDC | Reads ETH balance + USDC on Sepolia |

#### [MODIFY] Backend Files

- `src/lib/chainClients.ts` — Sepolia chain config instead of HashKey
- `src/routes/kyc.ts` — Remove Baby Jubjub signing, just return tier assessment
- `src/routes/price.ts` — Same (stock/crypto prices are chain-agnostic)
- `src/index.ts` — Rebrand to Ztocks

---

## Execution Phases

### Phase 1: Project Scaffolding
1. Initialize `contracts/` using Zama's fhevm-hardhat-template structure
2. Initialize `frontend/` with Next.js 16
3. Initialize `backend/` with Express.js
4. Copy design system (CSS, fonts, UI components)

### Phase 2: Smart Contracts
1. Write `ConfidentialTierManager.sol` with encrypted tier storage
2. Write `ConfidentialSynthVault.sol` with FHE position management
3. Write `ConfidentialLiquidation.sol` with encrypted health checks
4. Copy `SynthToken.sol`, `MockUSDC.sol`, `MockFeeToken.sol`
5. Write deploy script for Sepolia

### Phase 3: Frontend
1. Copy all UI primitives and landing components from the prior build
2. Adapt wagmi config for Sepolia
3. Adapt hooks for FHE (replace ZK proof flow with FHE encryption)
4. Adapt trading page, portfolio page
5. Update all branding to "Ztocks"

### Phase 4: Backend
1. Copy backend structure from the prior build
2. Adapt chain client for Sepolia
3. Simplify KYC route (no signing, just tier assessment)

### Phase 5: Integration & Testing
1. Deploy contracts to Sepolia
2. Connect frontend to deployed contracts
3. End-to-end test flow

---

## Verification Plan

### Automated Tests
- `npm run compile` in contracts/ — all FHE contracts compile
- `npm run dev` in frontend/ — dev server starts without errors
- `npm run dev` in backend/ — backend starts and health check passes

### Manual Verification
- Browser: Connect MetaMask to Sepolia, verify landing page loads
- Browser: Navigate to /trade, verify trading UI renders
- Contract deployment: Deploy to Sepolia and verify on Etherscan

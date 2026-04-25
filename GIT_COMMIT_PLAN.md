# Ztocks - Git Commit Plan

## Structured Development Phases

This document outlines the commit structure for pushing Ztocks to the repository in a logical, professional manner.

---

## Phase 1: Project Foundation & Setup

### Commit 1: Initial project structure
```bash
git add .gitignore README.md
git commit -m "chore: initialize Ztocks project structure

- Add project README with overview
- Configure gitignore for Node.js, Solidity, and Next.js
- Set up monorepo structure (contracts, frontend, backend, circuits)"
```

### Commit 2: Smart contracts setup
```bash
git add contracts/package.json contracts/hardhat.config.ts contracts/tsconfig.json contracts/.env.example
git commit -m "feat(contracts): initialize Hardhat project

- Configure Hardhat with Sepolia network support
- Add OpenZeppelin dependencies
- Set up TypeChain for type-safe contract interactions
- Configure Solidity compiler (0.8.24 with IR optimizer)"
```

### Commit 3: Circom circuits setup
```bash
git add circuits/package.json circuits/tier_proof.circom circuits/README.md circuits/scripts/
git commit -m "feat(circuits): add ZK proof circuit for tier verification

- Implement Circom circuit for KYC tier verification
- Add Groth16 proof generation setup
- Include circuit compilation scripts
- Add Baby Jubjub EdDSA signature verification"
```

---

## Phase 2: Core Smart Contracts (Non-FHE)

### Commit 4: Groth16 verifier contract
```bash
git add contracts/contracts/Groth16Verifier.sol
git commit -m "feat(contracts): add Groth16 verifier for ZK proofs

- Auto-generated verifier from Circom circuit
- Validates tier proofs on-chain
- Enables zero-knowledge identity verification"
```

### Commit 5: ZK verifier and tier registry
```bash
git add contracts/contracts/ZKVerifier.sol contracts/contracts/TierRegistry.sol
git commit -m "feat(contracts): implement ZK identity verification system

- ZKVerifier: validates Groth16 proofs and stores user tiers
- TierRegistry: manages tier-to-leverage mappings
- Anti-replay protection with nullifiers
- Oracle public key verification
- Credential expiry checks"
```

### Commit 6: Synth token and oracle
```bash
git add contracts/contracts/SynthToken.sol contracts/contracts/SynthOracle.sol
git commit -m "feat(contracts): add synthetic token infrastructure

- SynthToken: ERC-20 tokens for synthetic assets (sAAPL, sTSLA, etc.)
- SynthOracle: price feed integration for synthetic assets
- Mint/burn restricted to vault contract"
```

### Commit 7: Fee module
```bash
git add contracts/contracts/FeeModule.sol
git commit -m "feat(contracts): implement protocol fee system

- Configurable open/close fee rates
- Fee collection in protocol token
- Treasury management
- Fee rate caps for safety"
```

### Commit 8: Mock tokens for testing
```bash
git add contracts/contracts/mocks/
git commit -m "feat(contracts): add mock tokens for testnet

- MockUSDC: test USDC with faucet
- MockFeeToken: test protocol token
- Faucet functions for easy testing"
```

### Commit 9: Initial vault implementation
```bash
git add contracts/contracts/ConfidentialSynthVault.sol
git commit -m "feat(contracts): implement synthetic trading vault

- Open/close leveraged positions
- ZK-verified tier-based leverage enforcement
- Liquidation mechanism with health factor checks
- P&L calculation for long/short positions
- Integration with ZKVerifier for access control"
```

---

## Phase 3: FHE Integration (Zama Protocol)

### Commit 10: Add Zama FHE dependencies
```bash
git add contracts/package.json contracts/package-lock.json
git commit -m "feat(contracts): integrate Zama FHE library

- Add @fhevm/solidity for FHE operations
- Add encrypted-types for euint/ebool types
- Update dependencies for FHE support"
```

### Commit 11: FHE-enabled tier manager
```bash
git add contracts/contracts/ConfidentialTierManager.sol
git commit -m "feat(contracts): implement FHE-encrypted tier management

- Store user tiers as encrypted euint8
- Encrypted leverage validation using FHE operations
- checkLeverage() enforces caps on ciphertext
- Uses FHE.eq(), FHE.le(), FHE.and(), FHE.or()
- Inherits from ZamaEthereumConfig for Sepolia support"
```

### Commit 12: Update ZKVerifier for FHE integration
```bash
git add contracts/contracts/ZKVerifier.sol
git commit -m "feat(contracts): integrate ZKVerifier with FHE tier manager

- After ZK proof verification, encrypt and store tier
- Seamless ZK → FHE flow
- Maintains zero-knowledge identity privacy"
```

### Commit 13: FHE-native vault implementation
```bash
git add contracts/contracts/ConfidentialSynthVaultFHE.sol
git commit -m "feat(contracts): implement full FHE-encrypted trading vault

- Encrypted position struct (euint64, euint8, ebool)
- openPosition() with encrypted inputs (externalEuint types)
- Leverage enforcement on encrypted data
- FHE.select() for conditional logic
- FHE.mul() for encrypted calculations
- FHE.allow() for decryption permissions
- Hybrid mode for practical demo (openPositionHybrid)
- MEV-resistant: position params hidden from validators"
```

### Commit 14: Enable IR optimizer for FHE compilation
```bash
git add contracts/hardhat.config.ts
git commit -m "chore(contracts): enable IR optimizer for FHE contracts

- Set viaIR: true to handle stack depth
- Required for complex FHE operations
- Maintains optimizer settings for gas efficiency"
```

---

## Phase 4: Backend Services

### Commit 15: Backend setup
```bash
git add backend/package.json backend/tsconfig.json backend/.env.example backend/nodemon.json
git commit -m "feat(backend): initialize Express.js backend server

- Set up TypeScript Express server
- Configure environment variables
- Add nodemon for development
- Prepare for KYC oracle and price feeds"
```

### Commit 16: Chain clients and utilities
```bash
git add backend/src/lib/chainClients.ts
git commit -m "feat(backend): add blockchain client utilities

- Viem public client for Sepolia
- USDC contract integration
- Transaction count and balance queries
- Foundation for credit scoring"
```

### Commit 17: KYC oracle service
```bash
git add backend/src/routes/kyc.ts backend/src/index.ts
git commit -m "feat(backend): implement KYC oracle with credit scoring

- On-chain behavior analysis (tx count, balances)
- Credit score calculation (0-100)
- Tier derivation (1-4) based on score
- Baby Jubjub EdDSA credential signing
- REST API: POST /api/kyc/issue, GET /api/kyc/:address"
```

### Commit 18: Price oracle service
```bash
git add backend/src/routes/price.ts
git commit -m "feat(backend): add price oracle for synthetic assets

- Bybit API integration for crypto prices
- Finnhub API integration for stock prices
- Mock price fallback for testing
- Caching layer (5s TTL)
- REST API: GET /api/price/:ticker"
```

---

## Phase 5: Frontend Application

### Commit 19: Next.js setup
```bash
git add frontend/package.json frontend/next.config.ts frontend/tsconfig.json frontend/.env.example frontend/postcss.config.mjs frontend/components.json
git commit -m "feat(frontend): initialize Next.js 16 application

- Next.js 16 with React 19
- Tailwind CSS 4 configuration
- TypeScript setup
- Environment configuration
- Radix UI components base"
```

### Commit 20: Wagmi and RainbowKit setup
```bash
git add frontend/lib/wagmi.ts frontend/app/providers.tsx
git commit -m "feat(frontend): configure Web3 wallet integration

- Wagmi 2.x with Sepolia network
- RainbowKit for wallet connection UI
- React Query for blockchain data
- Custom Sepolia chain configuration"
```

### Commit 21: Contract ABIs and addresses
```bash
git add frontend/lib/contracts.ts frontend/lib/abis.ts
git commit -m "feat(frontend): add contract interfaces and ABIs

- Contract addresses for Sepolia deployment
- TypeScript ABIs for all contracts
- Asset token mappings (sAAPL, sTSLA, etc.)
- Type-safe contract interactions"
```

### Commit 22: UI components library
```bash
git add frontend/components/ui/
git commit -m "feat(frontend): add reusable UI component library

- Button, Input, Label primitives
- Dialog, Drawer, Select components
- Badge, Separator, Slider
- Alert, Bottom Sheet
- Token Logo component
- Leverage Slider component
- Consistent design system"
```

### Commit 23: App navigation and layout
```bash
git add frontend/components/app/ frontend/app/layout.tsx frontend/app/globals.css
git commit -m "feat(frontend): implement app navigation and layout

- AppNav with wallet connection
- Identity verification status display
- USDC balance indicator
- Global styles with Tailwind
- Figtree and Geist Mono fonts
- Responsive layout"
```

### Commit 24: Landing page
```bash
git add frontend/components/landing/ frontend/app/page.tsx
git commit -m "feat(frontend): create landing page

- Hero section with CTA
- Features showcase
- How it works explanation
- Live metrics display
- Security highlights
- Developer resources
- Footer with links"
```

### Commit 25: ZK identity verification
```bash
git add frontend/hooks/use-zk-identity.ts frontend/components/dashboard/verify-identity-modal.tsx
git commit -m "feat(frontend): implement ZK proof generation flow

- Client-side Groth16 proof generation with snarkjs
- Circuit artifact loading (wasm, zkey)
- Witness generation from credential
- Proof submission to ZKVerifier contract
- Identity status tracking
- Tier and leverage cap display"
```

### Commit 26: Trading interface
```bash
git add frontend/components/dashboard/trading-layout.tsx frontend/components/dashboard/markets-panel.tsx frontend/components/dashboard/trade-form.tsx frontend/app/trade/page.tsx
git commit -m "feat(frontend): build trading terminal UI

- Markets panel with asset list
- Trade form with leverage slider
- Long/Short position selection
- Fee preview and calculation
- Real-time price display
- Tier-based leverage limits
- Transaction status handling"
```

### Commit 27: Chart integration
```bash
git add frontend/components/dashboard/candlestick-chart.tsx frontend/hooks/use-chart-data.ts frontend/hooks/useFinnhubCandles.ts frontend/lib/chart-utils.ts
git commit -m "feat(frontend): add candlestick charts

- Lightweight Charts integration
- Multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Finnhub API for historical data
- Real-time price updates
- Market hours detection"
```

### Commit 28: Vault interactions
```bash
git add frontend/hooks/use-vault.ts
git commit -m "feat(frontend): implement vault interaction hooks

- openPosition() with encrypted inputs
- closePosition() with P&L calculation
- Position fetching and enrichment
- USDC/HSP balance tracking
- Transaction state management
- Error handling with toast notifications"
```

### Commit 29: Portfolio page
```bash
git add frontend/components/dashboard/positions-panel.tsx frontend/app/portfolio/page.tsx
git commit -m "feat(frontend): create portfolio management page

- Open positions table with live P&L
- Trade history with closed positions
- Quick close actions
- Total portfolio value
- Realized vs unrealized P&L
- Position filtering and sorting"
```

### Commit 30: Price feed integration
```bash
git add frontend/hooks/use-mock-prices.ts frontend/lib/finnhub.ts
git commit -m "feat(frontend): integrate real-time price feeds

- Backend API integration
- Finnhub stock prices
- Bybit crypto prices
- Mock fallback for testing
- Price caching and updates
- 24h change percentage"
```

### Commit 31: Utility functions
```bash
git add frontend/lib/utils.ts frontend/lib/tx-utils.ts frontend/lib/market-hours.ts
git commit -m "feat(frontend): add utility functions

- Transaction formatting and parsing
- Market hours calculation
- Class name utilities (cn)
- Date/time helpers
- Number formatting"
```

---

## Phase 6: Documentation & Polish

### Commit 32: Contract documentation
```bash
git add contracts/README.md
git commit -m "docs(contracts): add comprehensive contract documentation

- Architecture overview
- Contract descriptions
- Deployment instructions
- Testing guide
- FHE implementation details"
```

### Commit 33: Frontend documentation
```bash
git add frontend/README.md frontend/AGENTS.md frontend/CLAUDE.md
git commit -m "docs(frontend): add frontend documentation

- Setup instructions
- Component library guide
- Hook usage examples
- Environment configuration
- Development workflow"
```

### Commit 34: Backend documentation
```bash
git add backend/README.md
git commit -m "docs(backend): add backend API documentation

- API endpoint reference
- Credit scoring model explanation
- KYC oracle flow
- Price feed integration
- Deployment guide"
```

### Commit 35: Circuit documentation
```bash
git add circuits/README.md
git commit -m "docs(circuits): add ZK circuit documentation

- Circuit design explanation
- Proof generation guide
- Setup instructions
- Public/private signal layout"
```

### Commit 36: Project documentation
```bash
git add README.md implementation_plan.md
git commit -m "docs: add project overview and implementation plan

- Ztocks project description
- Dual privacy stack (ZK + FHE)
- Architecture diagrams
- Development roadmap
- Hackathon submission details"
```

### Commit 37: Final polish
```bash
git add .
git commit -m "chore: final polish and cleanup

- Remove temporary files
- Update all package versions
- Verify all configurations
- Ensure consistent formatting
- Ready for deployment"
```

---

## Execution Commands

### Setup Git (if not already done)
```bash
git init
git remote add origin https://github.com/Rohitamalraj/Ztocks.git
```

### Execute All Commits
```bash
# Phase 1: Foundation
git add .gitignore README.md
git commit -m "chore: initialize Ztocks project structure"

git add contracts/package.json contracts/hardhat.config.ts contracts/tsconfig.json contracts/.env.example
git commit -m "feat(contracts): initialize Hardhat project"

git add circuits/package.json circuits/tier_proof.circom circuits/README.md circuits/scripts/
git commit -m "feat(circuits): add ZK proof circuit for tier verification"

# Phase 2: Core Contracts
git add contracts/contracts/Groth16Verifier.sol
git commit -m "feat(contracts): add Groth16 verifier for ZK proofs"

git add contracts/contracts/ZKVerifier.sol contracts/contracts/TierRegistry.sol
git commit -m "feat(contracts): implement ZK identity verification system"

git add contracts/contracts/SynthToken.sol contracts/contracts/SynthOracle.sol
git commit -m "feat(contracts): add synthetic token infrastructure"

git add contracts/contracts/FeeModule.sol
git commit -m "feat(contracts): implement protocol fee system"

git add contracts/contracts/mocks/
git commit -m "feat(contracts): add mock tokens for testnet"

git add contracts/contracts/ConfidentialSynthVault.sol
git commit -m "feat(contracts): implement synthetic trading vault"

# Phase 3: FHE Integration
git add contracts/package.json contracts/package-lock.json
git commit -m "feat(contracts): integrate Zama FHE library"

git add contracts/contracts/ConfidentialTierManager.sol
git commit -m "feat(contracts): implement FHE-encrypted tier management"

git add contracts/contracts/ZKVerifier.sol
git commit -m "feat(contracts): integrate ZKVerifier with FHE tier manager"

git add contracts/contracts/ConfidentialSynthVaultFHE.sol
git commit -m "feat(contracts): implement full FHE-encrypted trading vault"

git add contracts/hardhat.config.ts
git commit -m "chore(contracts): enable IR optimizer for FHE contracts"

# Phase 4: Backend
git add backend/package.json backend/tsconfig.json backend/.env.example backend/nodemon.json
git commit -m "feat(backend): initialize Express.js backend server"

git add backend/src/lib/chainClients.ts
git commit -m "feat(backend): add blockchain client utilities"

git add backend/src/routes/kyc.ts backend/src/index.ts
git commit -m "feat(backend): implement KYC oracle with credit scoring"

git add backend/src/routes/price.ts
git commit -m "feat(backend): add price oracle for synthetic assets"

# Phase 5: Frontend
git add frontend/package.json frontend/next.config.ts frontend/tsconfig.json frontend/.env.example frontend/postcss.config.mjs frontend/components.json
git commit -m "feat(frontend): initialize Next.js 16 application"

git add frontend/lib/wagmi.ts frontend/app/providers.tsx
git commit -m "feat(frontend): configure Web3 wallet integration"

git add frontend/lib/contracts.ts frontend/lib/abis.ts
git commit -m "feat(frontend): add contract interfaces and ABIs"

git add frontend/components/ui/
git commit -m "feat(frontend): add reusable UI component library"

git add frontend/components/app/ frontend/app/layout.tsx frontend/app/globals.css
git commit -m "feat(frontend): implement app navigation and layout"

git add frontend/components/landing/ frontend/app/page.tsx
git commit -m "feat(frontend): create landing page"

git add frontend/hooks/use-zk-identity.ts frontend/components/dashboard/verify-identity-modal.tsx
git commit -m "feat(frontend): implement ZK proof generation flow"

git add frontend/components/dashboard/trading-layout.tsx frontend/components/dashboard/markets-panel.tsx frontend/components/dashboard/trade-form.tsx frontend/app/trade/page.tsx
git commit -m "feat(frontend): build trading terminal UI"

git add frontend/components/dashboard/candlestick-chart.tsx frontend/hooks/use-chart-data.ts frontend/hooks/useFinnhubCandles.ts frontend/lib/chart-utils.ts
git commit -m "feat(frontend): add candlestick charts"

git add frontend/hooks/use-vault.ts
git commit -m "feat(frontend): implement vault interaction hooks"

git add frontend/components/dashboard/positions-panel.tsx frontend/app/portfolio/page.tsx
git commit -m "feat(frontend): create portfolio management page"

git add frontend/hooks/use-mock-prices.ts frontend/lib/finnhub.ts
git commit -m "feat(frontend): integrate real-time price feeds"

git add frontend/lib/utils.ts frontend/lib/tx-utils.ts frontend/lib/market-hours.ts
git commit -m "feat(frontend): add utility functions"

# Phase 6: Documentation
git add contracts/README.md
git commit -m "docs(contracts): add comprehensive contract documentation"

git add frontend/README.md frontend/AGENTS.md frontend/CLAUDE.md
git commit -m "docs(frontend): add frontend documentation"

git add backend/README.md
git commit -m "docs(backend): add backend API documentation"

git add circuits/README.md
git commit -m "docs(circuits): add ZK circuit documentation"

git add README.md implementation_plan.md
git commit -m "docs: add project overview and implementation plan"

git add .
git commit -m "chore: final polish and cleanup"

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Alternative: Squashed Approach (Simpler)

If you prefer fewer, larger commits:

```bash
# Commit 1: Project setup
git add contracts/package.json contracts/hardhat.config.ts circuits/package.json backend/package.json frontend/package.json .gitignore
git commit -m "chore: initialize Ztocks monorepo structure"

# Commit 2: Smart contracts
git add contracts/contracts/
git commit -m "feat(contracts): implement ZK + FHE synthetic trading contracts"

# Commit 3: Backend
git add backend/src/
git commit -m "feat(backend): add KYC oracle and price feed services"

# Commit 4: Frontend
git add frontend/
git commit -m "feat(frontend): build Next.js trading interface"

# Commit 5: Documentation
git add README.md */README.md
git commit -m "docs: add comprehensive documentation"

git push -u origin main
```

---

## Notes

- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- Keep commits atomic and focused
- Write clear, descriptive commit messages
- Each commit should compile/work independently

---

## Ready to Push!

Choose your preferred approach (detailed or squashed) and execute the commands above.

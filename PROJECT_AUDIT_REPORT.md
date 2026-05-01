# Ztocks — Codebase Audit Report

Date: 2026-05-01

## 1) Executive Summary

- **Market data in the UI is live (Finnhub)**: The frontend polls a Next.js API route that fetches quotes from Finnhub. No random/mock price generator is present in the runtime path.
- **Trade execution price is not oracle-enforced on-chain (hackathon simplification)**: The Sepolia vault contract accepts an `executionPrice` argument from the caller and only checks it is non-zero; it does not verify the price against an on-chain oracle.
- **Sepolia deployments are recorded and are wired via frontend env**: Deployed addresses are in `contracts/deployments/sepolia.json`; the frontend reads addresses from `NEXT_PUBLIC_*` env vars in `frontend/lib/contracts.ts`.
- **Branding cleanup (runtime)**: The misleading `useMockPrices` hook was replaced with `useAssetQuotes`, and remaining runtime/UI `zkSynth` strings were removed or renamed to `Ztocks`.

## 2) “Real vs Mock” Data — What’s Actually Used

### 2.1 Live quote path used by Trade / SIP / Portfolio

**Runtime call chain:**

1. UI polls quotes: `frontend/hooks/use-asset-quotes.ts`
2. Next.js quote endpoint: `frontend/app/api/stocks/quotes/route.ts`
3. Finnhub client: `frontend/lib/finnhub.ts`
4. External API: `https://finnhub.io/api/v1/quote?symbol=...&token=...`

**Notes:**
- The Finnhub API key is read server-side as `FINNHUB_API_KEY`.
- If Finnhub is rate-limiting (HTTP 429) or the API key is missing, the app will not fabricate prices; it will serve cached/previous values where available and otherwise show zeros.

### 2.2 Candlestick / chart data

- Candles are fetched via `frontend/lib/finnhub.ts` (`/stock/candle` endpoint) and used by chart hooks/components (e.g., `frontend/hooks/useFinnhubCandles.ts`).

### 2.3 Backend “price oracle” endpoint

- The backend contains a price route and mentions Bybit + Finnhub in docs, but **the current trading UI path uses the frontend Next.js quotes route**, not the backend price API.
- If you want a single canonical price service, you can either:
  - Route the frontend through the backend price endpoint, or
  - Remove/trim the backend price endpoint and keep market data entirely inside the Next.js app.

## 3) Price Feed Correctness (What it is, and what it is not)

### 3.1 Correctness for display/UX

- Quotes displayed in Trade/SIP/Portfolio come from Finnhub (`quote.c`, `quote.d`, `quote.dp`, `quote.pc`), via the server-side Next.js proxy route.
- Caching/throttling behavior exists in `frontend/lib/finnhub.ts` (quote TTL and rate-limit backoff).

### 3.2 Correctness for execution/security

- **Important:** The on-chain vault does not independently validate execution price.
- The vault contract explicitly documents the hackathon simplification around execution price and synth amount math in `contracts/contracts/ConfidentialSynthVaultFHE.sol`.

Implication:
- The system currently provides **live prices for UI**, but **does not provide trust-minimized execution pricing**.

## 4) On-Chain Execution Path (Sepolia)

### 4.1 Where the execution price comes from

- The frontend computes/reads the latest quote and passes it as `executionPrice` into vault methods (see `frontend/hooks/use-vault.ts`).

### 4.2 What the vault enforces

In `contracts/contracts/ConfidentialSynthVaultFHE.sol`:
- **Tier gating**: `openPosition*` requires `zkVerifier.isVerified(msg.sender)`.
- **Asset registry**: requires the synth token to be registered.
- **Leverage cap**: enforced through FHE logic via `tierManager.checkLeverage(...)`.
- **Execution price**: checked only as non-zero in the plaintext paths (`openPositionHybrid`, `closePosition`).

## 5) Sepolia Deployment Inventory

Source of truth: `contracts/deployments/sepolia.json`

Recorded addresses include:
- `ZKVerifier`
- `ConfidentialTierManager`
- `ConfidentialSynthVaultFHE`
- `ConfidentialUSDC` (cUSDC)
- `underlyingUSDC`
- Synth tokens: `csAAPL`, `csTSLA`, `csNVDA`, `csSPY`, `csAMZN`, `csMSFT`, `csMETA`, `csNFLX`, `csAMD`

Frontend wiring:
- `frontend/lib/contracts.ts` reads addresses from `NEXT_PUBLIC_*` environment variables and maps symbols (e.g. `sAAPL`) to synth token addresses (e.g. `csAAPL`).

## 6) “zkSynth” Dependency / Coupling Assessment

### 6.1 Runtime code

- No runtime code path requires a zkSynth package/repo.
- Remaining runtime/UI references were renamed to `Ztocks`:
  - Navigation branding
  - Console log tags
  - SIP localStorage key
  - Misleading “mock prices” naming

### 6.2 Repository docs & artifacts

Some **historical/working documents** still reference “zkSynth” as a source/baseline concept and may be kept as reference material:
- `CORRECTED_HACKATHON_BRIEF.md`
- `ZAMA_IMPLEMENTATION_ROADMAP.md`
- `WORDING_FIXES.md`
- `FHE_IMPLEMENTATION_COMPLETE.md`
- `implementation_plan.md`

There is also at least one generated contract build artifact containing legacy strings under `contracts/artifacts/build-info/`.

If you want a “zero matches” repository grep (strict rebrand), these files should be updated/archived and build outputs regenerated/cleaned.

## 7) Recommendations (High Signal)

1. **If execution correctness matters**, add an oracle-verified execution price path (on-chain oracle, signed off-chain price attestations, or a trusted relayer) and validate inside the vault.
2. Decide whether the **backend price oracle** is a requirement. If not, remove it (or clearly mark it unused).
3. If you need a strict “no zkSynth strings anywhere” standard, do a controlled rename pass on the remaining docs and regenerate/remove stale build artifacts.

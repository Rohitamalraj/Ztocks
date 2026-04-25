# zkSynth Frontend

> **Next.js 16 frontend for privacy-preserving synthetic asset trading**

Modern, responsive trading interface built with Next.js, React 19, Tailwind CSS, and RainbowKit for wallet connectivity.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Routes](#routes)
- [Components](#components)
- [Hooks](#hooks)
- [Configuration](#configuration)

---

## ✨ Features

- 🎨 **Modern UI** - Clean, minimal design with Tailwind CSS
- 📊 **Live Charts** - Real-time candlestick charts with Lightweight Charts
- 🔐 **Wallet Integration** - RainbowKit + Wagmi for seamless wallet connection
- 🧮 **ZK Proof Generation** - In-browser Groth16 proof generation with snarkjs
- 📈 **Portfolio Tracking** - Real-time P&L, open positions, trade history
- 🔄 **SIP Plans** - Dollar-cost averaging with automated execution
- 🎯 **Responsive Design** - Mobile-first, works on all devices
- ⚡ **Fast Performance** - Next.js 16 with React Server Components

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16.2 |
| **React** | React 19.2 |
| **Styling** | Tailwind CSS 4 |
| **Wallet** | RainbowKit 2.2 + Wagmi 2.19 |
| **Blockchain** | Viem 2.47 |
| **ZK Proofs** | snarkjs 0.7.6 + circomlibjs 0.1.7 |
| **Charts** | Lightweight Charts 4.2 |
| **UI Components** | Radix UI |
| **State** | React Query (TanStack Query 5.97) |
| **Notifications** | Sonner 2.0 |

---

## 📁 Project Structure

```
frontend/
├── app/                        # Next.js 16 app directory
│   ├── layout.tsx             # Root layout with providers
│   ├── page.tsx               # Landing page
│   ├── providers.tsx          # RainbowKit + Wagmi providers
│   ├── globals.css            # Global styles
│   ├── api/                   # API routes
│   │   ├── stocks/
│   │   │   ├── quotes/route.ts
│   │   │   └── candles/route.ts
│   │   ├── zk-proof/
│   │   │   └── log/route.ts
│   │   └── kyc/
│   │       ├── issue/route.ts
│   │       └── [address]/route.ts
│   ├── trade/
│   │   └── page.tsx           # Trading terminal
│   ├── portfolio/
│   │   └── page.tsx           # Portfolio & history
│   └── sip/
│       └── page.tsx           # SIP planner
│
├── components/
│   ├── app/                   # App-level components
│   │   ├── app-nav.tsx        # Navigation bar
│   │   └── wallet-button.tsx # Wallet connection
│   ├── dashboard/             # Trading UI components
│   │   ├── trading-layout.tsx
│   │   ├── markets-panel.tsx
│   │   ├── candlestick-chart.tsx
│   │   ├── trade-form.tsx
│   │   ├── positions-panel.tsx
│   │   ├── verify-identity-modal.tsx
│   │   ├── portfolio-sip-section.tsx
│   │   └── sip-planner-panel.tsx
│   ├── landing/               # Landing page sections
│   │   ├── hero-section.tsx
│   │   ├── features-section.tsx
│   │   ├── how-it-works-section.tsx
│   │   ├── metrics-section.tsx
│   │   ├── integrations-section.tsx
│   │   ├── security-section.tsx
│   │   ├── developers-section.tsx
│   │   ├── cta-section.tsx
│   │   └── footer-section.tsx
│   └── ui/                    # Reusable UI primitives
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── slider.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── tooltip.tsx
│       └── token-logo.tsx
│
├── hooks/                     # React hooks
│   ├── use-vault.ts          # Vault interactions
│   ├── use-zk-identity.ts    # ZK proof generation
│   ├── use-kyc-tier.ts       # KYC tier queries
│   ├── use-positions.ts      # Position management
│   ├── use-sip-plans.ts      # SIP plan storage
│   ├── use-mock-prices.ts    # Price feed integration
│   ├── use-chart-data.ts     # Chart data fetching
│   ├── use-debounce.ts       # Debounce utility
│   └── useFinnhubCandles.ts  # Finnhub API integration
│
├── lib/                       # Utilities & configs
│   ├── contracts.ts          # Contract addresses
│   ├── abis.ts               # Contract ABIs
│   ├── wagmi.ts              # Wagmi configuration
│   ├── utils.ts              # Utility functions
│   ├── tx-utils.ts           # Transaction helpers
│   ├── chart-utils.ts        # Chart utilities
│   ├── market-hours.ts       # Market hours logic
│   ├── finnhub.ts            # Finnhub client
│   └── sparkline-data.ts     # Sparkline generation
│
├── public/
│   └── circuits/              # Circuit artifacts
│       ├── tier_proof.wasm
│       ├── tier_proof_0001.zkey
│       └── verification_key.json
│
├── types/
│   └── circomlibjs.d.ts      # Type definitions
│
├── .env.example               # Environment template
├── .env.local                 # Local environment (gitignored)
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create `.env.local`:

```bash
# WalletConnect (required)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Backend API (required)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Contract Addresses (optional - defaults in lib/contracts.ts)
NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=0x96Ea965269c8Cb8D65bd03bb5Ce6e9b70d7c1b93
NEXT_PUBLIC_TIER_MANAGER_ADDRESS=0xbb631a9E67bd336bb66d4524a65CD3949EeDC2f9
NEXT_PUBLIC_SYNTH_VAULT_ADDRESS=0xF8c3b3CC3f72D607cdb07D56C653bDb94ea58497
NEXT_PUBLIC_SYNTH_ORACLE_ADDRESS=0xb317FC715E8b8893a01bE37C29aCb55D7AB66c40
NEXT_PUBLIC_HSP_FEE_MODULE_ADDRESS=0x6d6990D7250F0342bf8f3e12B85899a97125DecC
NEXT_PUBLIC_USDC_ADDRESS=0x6b0C6080A5052793C3B8A771b79a41794a3e5Dc2
NEXT_PUBLIC_HSP_ADDRESS=0x4a8d15D04d97F53db3c081630F138F36aD7ea200

# Synth Token Addresses (optional)
NEXT_PUBLIC_SAAPL_ADDRESS=0xD9626127821D1fa995c42843195478D3d838224F
NEXT_PUBLIC_STSLA_ADDRESS=0x1388D39d52987a39c712E389F6948CdF240E84e1
NEXT_PUBLIC_SNVDA_ADDRESS=0xCc457EEF0358eD16Ea29C3522e094B8aE0fFab73
NEXT_PUBLIC_SSPY_ADDRESS=0x2a9Cc634B1C38505adFF00bbb0bAAB6dff67203C
NEXT_PUBLIC_SAMZN_ADDRESS=0x90d70C34E329bd07aaF94845f60289b42528F0b8
NEXT_PUBLIC_SMSFT_ADDRESS=0x1815caddB6Ad1948222303700f54c8A2D748Ec42
NEXT_PUBLIC_SMETA_ADDRESS=0xe119F0f72Ce3d35165c933B2fD4Cb13f3c96f785
NEXT_PUBLIC_SNFLX_ADDRESS=0xccb4Fc7c8485D2C5D1c40F64a1A0d32295a7EF08
NEXT_PUBLIC_SAMD_ADDRESS=0x48f92A16580c1Df0d84655F14601db42EB2a1b8c

# Price API Keys (optional - uses mock prices if not provided)
NEXT_PUBLIC_FINNHUB_API_KEY=your_finnhub_key
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

---

## 🗺️ Routes

### Landing Page (`/`)

**Purpose:** Protocol overview and marketing

**Sections:**
- Hero with CTA
- Key features
- How it works
- Live metrics
- Integrations (HashKey, SUPRA, HSP)
- Security highlights
- Developer resources
- Footer

### Trading Terminal (`/trade`)

**Purpose:** Manual trading interface

**Features:**
- Live market list with search/filter
- Candlestick chart with multiple timeframes
- Trade form with leverage slider
- Open positions table
- Real-time P&L tracking
- Identity verification modal

**Layout:**
```
┌─────────────────────────────────────────┐
│           Stats Bar (Ticker Info)       │
├──────────┬──────────────────┬───────────┤
│          │                  │           │
│ Markets  │  Candlestick     │  Trade    │
│ Panel    │  Chart           │  Form     │
│          │                  │           │
├──────────┴──────────────────┴───────────┤
│        Open Positions Table             │
└─────────────────────────────────────────┘
```

### Portfolio (`/portfolio`)

**Purpose:** Position management and trade history

**Features:**
- Portfolio value summary
- Total P&L (open + realized)
- Open positions table with live mark prices
- Trade history with closed P&L
- Quick close position actions

**Tabs:**
- **Open Positions** - Active trades with live P&L
- **Trade History** - All trades (open + closed)

### SIP Planner (`/sip`)

**Purpose:** Dollar-cost averaging automation

**Features:**
- Create DCA plans (asset, amount, frequency)
- Active/paused plan management
- Manual execution button
- Auto-execution (runs every 60s when page open)
- Portfolio overview with SIP positions

**SIP Behavior:**
- Direction: LONG only (DCA mode)
- Leverage: 1x fixed
- Frequencies: DAILY, WEEKLY, MONTHLY
- Storage: Local storage (`zksynth.sip.plans.v1`)

---

## 🧩 Components

### Core Components

#### AppNav (`components/app/app-nav.tsx`)

Navigation bar with wallet connection, identity status, and USDC balance.

```tsx
<AppNav
  onVerifyClick={() => setVerifyModalOpen(true)}
  isVerified={identity.isVerified}
  tier={identity.tier}
  usdcBalance={vault.usdcBalance}
/>
```

#### VerifyIdentityModal (`components/dashboard/verify-identity-modal.tsx`)

Modal for ZK proof generation and submission.

**Flow:**
1. Request credential from backend
2. Generate Groth16 proof in browser
3. Submit proof to ZKVerifier contract
4. Display tier and leverage cap

```tsx
<VerifyIdentityModal
  open={verifyModalOpen}
  onOpenChange={setVerifyModalOpen}
  identityState={identity}
/>
```

#### TradeForm (`components/dashboard/trade-form.tsx`)

Trade execution form with leverage slider and fee preview.

```tsx
<TradeForm
  ticker="sAAPL"
  currentPrice={180.25}
  maxLeverage={5}
  isTradeEnabled={true}
  isConnected={true}
  isVerified={true}
  usdcBalance={1000}
  txStatus="idle"
  onTrade={handleTrade}
  isTrading={false}
  onVerifyClick={() => setVerifyModalOpen(true)}
/>
```

#### CandlestickChart (`components/dashboard/candlestick-chart.tsx`)

Real-time candlestick chart with Lightweight Charts.

**Timeframes:** 1m, 5m, 15m, 1h, 4h, 1d

```tsx
<CandlestickChart
  ticker="sAAPL"
  selectedTimeframe="1h"
  onTimeframeChange={setTimeframe}
  marketOpen={true}
/>
```

#### PositionsPanel (`components/dashboard/positions-panel.tsx`)

Table of open positions with close actions.

```tsx
<PositionsPanel
  positions={enrichedPositions}
  onClosePosition={handleClose}
  isClosing={closingPositionId}
/>
```

---

## 🪝 Hooks

### useVault (`hooks/use-vault.ts`)

Vault interaction hook for opening/closing positions.

```tsx
const vault = useVault();

// Open position
await vault.openPosition(
  "sAAPL",      // asset
  "LONG",       // direction
  1000,         // collateral USDC
  5,            // leverage
  180.25        // execution price
);

// Close position
await vault.closePosition(
  0,            // position index
  185.50        // execution price
);

// State
vault.positions        // Open positions
vault.allPositions     // All positions (open + closed)
vault.usdcBalance      // USDC balance
vault.hspBalance       // HSP balance
vault.txStatus         // Transaction status
```

### useZkIdentity (`hooks/use-zk-identity.ts`)

ZK proof generation and identity verification.

```tsx
const identity = useZkIdentity();

// Generate and submit proof
await identity.verifyIdentity();

// State
identity.isVerified    // Verification status
identity.tier          // KYC tier (1-4)
identity.leverageCap   // Max leverage
identity.expiry        // Credential expiry
identity.status        // Proof generation status
```

**Proof Generation Flow:**
1. Fetch credential from backend
2. Load circuit artifacts (`.wasm`, `.zkey`)
3. Generate witness
4. Generate Groth16 proof with snarkjs
5. Submit proof to ZKVerifier contract

### useSipPlans (`hooks/use-sip-plans.ts`)

SIP plan management with local storage persistence.

```tsx
const {
  plans,
  isLoaded,
  createPlan,
  deletePlan,
  togglePlan,
  markPlanExecuted
} = useSipPlans();

// Create plan
createPlan({
  asset: "sAAPL",
  collateralUSDC: 100,
  frequency: "WEEKLY",
  isActive: true
});

// Toggle active status
togglePlan(planId);

// Mark as executed (updates nextRunAt)
markPlanExecuted(planId);
```

### useMockPrices (`hooks/use-mock-prices.ts`)

Real-time price feed integration.

```tsx
const prices = useMockPrices();

// Access prices
prices["sAAPL"].price          // Current price
prices["sAAPL"].changePercent  // 24h change %
prices["sAAPL"].timestamp      // Last update
```

**Data Sources:**
1. Backend API (`/api/price`)
2. Finnhub API (stocks)
3. Bybit API (crypto)
4. Mock fallback

---

## ⚙️ Configuration

### Wagmi Configuration (`lib/wagmi.ts`)

```tsx
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hashkeyTestnet } from './chains';

export const config = getDefaultConfig({
  appName: 'zkSynth Access',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [hashkeyTestnet],
  ssr: true,
});
```

### Contract Addresses (`lib/contracts.ts`)

```tsx
export const CONTRACTS = {
  ZKVerifier: "0x96Ea965269c8Cb8D65bd03bb5Ce6e9b70d7c1b93",
  TierManager: "0xbb631a9E67bd336bb66d4524a65CD3949EeDC2f9",
  SynthVault: "0xF8c3b3CC3f72D607cdb07D56C653bDb94ea58497",
  // ... etc
};

export const ASSET_TOKENS: Record<AssetSymbol, `0x${string}`> = {
  sAAPL: CONTRACTS.sAAPL as `0x${string}`,
  sTSLA: CONTRACTS.sTSLA as `0x${string}`,
  // ... etc
};
```

### Tailwind Configuration (`tailwind.config.ts`)

```tsx
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // ... etc
      },
    },
  },
  plugins: [],
};
```

---

## 🎨 Styling

### Design System

- **Font:** Figtree (sans-serif), Geist Mono (monospace)
- **Colors:** Minimal palette with foreground/background variants
- **Spacing:** Tailwind default scale
- **Borders:** 1px solid with foreground/10 opacity
- **Animations:** Subtle transitions, no heavy animations

### Component Patterns

```tsx
// Card
<div className="border border-foreground/10 p-4">
  {/* content */}
</div>

// Button
<button className="px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 transition-colors">
  Action
</button>

// Input
<input className="w-full px-3 py-2 bg-background border border-foreground/20 font-mono text-sm focus:outline-none focus:border-foreground" />
```

---

## 🔧 Development Tips

### Hot Reload

Next.js 16 supports fast refresh. Changes to components, pages, and styles reload instantly.

### Type Safety

All components are fully typed with TypeScript. Use `@ts-expect-error` sparingly.

### Error Handling

Use `try/catch` with toast notifications:

```tsx
try {
  await vault.openPosition(...);
  toast.success("Position opened!");
} catch (error) {
  console.error(error);
  toast.error(error.message || "Transaction failed");
}
```

### Performance

- Use `useMemo` for expensive computations
- Use `useCallback` for event handlers passed to children
- Lazy load heavy components with `dynamic()`

---

## 📊 State Management

### React Query

Used for blockchain data fetching:

```tsx
const { data: tier } = useReadContract({
  address: CONTRACTS.ZKVerifier,
  abi: ZK_VERIFIER_ABI,
  functionName: 'getTier',
  args: [address],
});
```

### Local State

- Component state: `useState`
- Form state: `useState` + controlled inputs
- Global state: React Context (via `providers.tsx`)

### Persistence

- SIP plans: Local storage (`localStorage`)
- Wallet connection: RainbowKit persistence
- User preferences: Local storage (future)

---

## 🐛 Debugging

### Browser Console

Check console for:
- Transaction errors
- Proof generation logs
- API request failures

### React DevTools

Install React DevTools extension to inspect component tree and state.

### Network Tab

Monitor API requests to backend and RPC calls to HashKey Chain.

### Common Issues

**Issue:** Proof generation fails  
**Solution:** Check circuit artifacts exist in `public/circuits/`

**Issue:** Transaction reverts  
**Solution:** Check wallet has sufficient USDC/HSP and gas

**Issue:** Prices not loading  
**Solution:** Verify backend is running and `NEXT_PUBLIC_BACKEND_URL` is correct

---

## 📦 Build & Deploy

### Build for Production

```bash
npm run build
```

Output in `.next/` directory.

### Deploy to Vercel

```bash
vercel
```

Or connect GitHub repo to Vercel dashboard for automatic deployments.

### Environment Variables

Set all `NEXT_PUBLIC_*` variables in Vercel dashboard under Settings → Environment Variables.

---

## 🧪 Testing (Future)

Recommended testing stack:

- **Unit Tests:** Vitest
- **Component Tests:** React Testing Library
- **E2E Tests:** Playwright
- **Visual Tests:** Chromatic

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Wagmi Docs](https://wagmi.sh/)
- [RainbowKit Docs](https://www.rainbowkit.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/docs)

---

**Built with ❤️ for the HashKey Hackathon 2026**

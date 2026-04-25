/** Generate deterministic mock sparkline data - trending down (negative) or up (positive) */
function generateSparkline(
  basePrice: number,
  changePercent: number,
  points = 24,
  seed = 0
): number[] {
  const data: number[] = []
  const totalChange = basePrice * (changePercent / 100)
  for (let i = 0; i <= points; i++) {
    const t = i / points
    const noise = Math.sin((i + seed) * 2.1) * 0.008 + Math.cos((i + seed) * 1.3) * 0.005
    const price = basePrice - totalChange * (1 - t) + basePrice * noise
    data.push(Math.max(price, 0.01))
  }
  return data
}

export type AssetData = {
  id: string
  ticker: string
  name: string
  price: number
  change24h: number
  change24hPercent: number
  sparklineData: number[]
  icon: string
  iconBg: string
  category: string
  categories: string[]
  marketCap?: string
  addedDate?: string // "2 days ago", "1 week ago" for Newly Added
  address?: string // ERC20 token address for this stock
  chainId?: number // Chain ID where this stock is deployed
}

// Canonical list of on-chain stock tokens (15 only) mapped to real-world tickers
// All deployed on Base Mainnet
export const ASSETS: AssetData[] = [
  {
    id: "1",
    ticker: "AAPL",
    name: "Apple Inc.",
    price: 230.12,
    change24h: 2.34,
    change24hPercent: 1.03,
    sparklineData: generateSparkline(227.78, 1.03, 24, 1),
    icon: "AP",
    iconBg: "bg-zinc-100 text-zinc-800",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$3.6T",
    address: "0x9530f7d8F774cE3b3eDa95229E24687Fe072dD7B",
    chainId: 8453, // Base
  },
  {
    id: "2",
    ticker: "AMZN",
    name: "Amazon.com Inc.",
    price: 215.45,
    change24h: 1.76,
    change24hPercent: 0.83,
    sparklineData: generateSparkline(213.69, 0.83, 24, 2),
    icon: "AM",
    iconBg: "bg-amber-100 text-amber-700",
    category: "Consumer",
    categories: ["Consumer", "Large Cap", "Growth"],
    marketCap: "$2.2T",
    address: "0xaA7389Cc693354624D487737989F6806f815A5D2",
    chainId: 8453, // Base
  },
  {
    id: "3",
    ticker: "GOOG",
    name: "Alphabet Inc. (Class C)",
    price: 185.37,
    change24h: 0.92,
    change24hPercent: 0.5,
    sparklineData: generateSparkline(184.45, 0.5, 24, 3),
    icon: "GO",
    iconBg: "bg-violet-100 text-violet-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$2.4T",
    address: "0xEC018557a1Ab92DC04D2655E268E1FEcf321F8b5",
    chainId: 8453, // Base
  },
  {
    id: "4",
    ticker: "MSFT",
    name: "Microsoft Corporation",
    price: 452.86,
    change24h: -3.12,
    change24hPercent: -0.69,
    sparklineData: generateSparkline(455.98, -0.69, 24, 4),
    icon: "MS",
    iconBg: "bg-sky-100 text-sky-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$3.4T",
    address: "0xf1b6A03293463BF824aC4F559C2948E1C5b1852e",
    chainId: 8453, // Base
  },
  {
    id: "5",
    ticker: "TSLA",
    name: "Tesla Inc.",
    price: 390.21,
    change24h: -8.45,
    change24hPercent: -2.12,
    sparklineData: generateSparkline(398.66, -2.12, 24, 5),
    icon: "TS",
    iconBg: "bg-rose-100 text-rose-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$1.2T",
    address: "0xd201A97A0C33441f4bea12d9890703f92f3c0A32",
    chainId: 8453, // Base
  },
  {
    id: "6",
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    price: 192.43,
    change24h: -5.67,
    change24hPercent: -2.86,
    sparklineData: generateSparkline(198.1, -2.86, 24, 6),
    icon: "NV",
    iconBg: "bg-emerald-100 text-emerald-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$4.7T",
    address: "0xD19b51A44a13213B3afCCFf91245f2dAee5D570B",
    chainId: 8453, // Base
  },
  {
    id: "7",
    ticker: "PFE",
    name: "Pfizer Inc.",
    price: 31.72,
    change24h: 0.54,
    change24hPercent: 1.73,
    sparklineData: generateSparkline(31.18, 1.73, 24, 7),
    icon: "PF",
    iconBg: "bg-teal-100 text-teal-700",
    category: "Healthcare",
    categories: ["Healthcare", "Large Cap", "Value"],
    marketCap: "$178B",
    address: "0xA46B069488926fc15430404Ea29c3032A1F3654C",
    chainId: 8453, // Base
  },
  {
    id: "8",
    ticker: "INTC",
    name: "Intel Corporation",
    price: 47.18,
    change24h: -1.08,
    change24hPercent: -2.24,
    sparklineData: generateSparkline(48.26, -2.24, 24, 8),
    icon: "IN",
    iconBg: "bg-blue-100 text-blue-800",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Value"],
    marketCap: "$195B",
    address: "0x89FFd589d7Ebd966B18b8643EAb3E3018EE494d7",
    chainId: 8453, // Base
  },
  {
    id: "9",
    ticker: "SOFI",
    name: "SoFi Technologies Inc.",
    price: 23.04,
    change24h: -0.76,
    change24hPercent: -3.19,
    sparklineData: generateSparkline(23.8, -3.19, 24, 9),
    icon: "SF",
    iconBg: "bg-teal-100 text-teal-700",
    category: "Financials",
    categories: ["Financials", "Growth"],
    marketCap: "$18.5B",
    address: "0x1Cf30db4Cbe5A76b6f9E2cfFeD3E25ab36041283",
    chainId: 8453, // Base
  },
  {
    id: "10",
    ticker: "OPEN",
    name: "Opendoor Technologies Inc.",
    price: 4.36,
    change24h: 0.19,
    change24hPercent: 4.56,
    sparklineData: generateSparkline(4.17, 4.56, 24, 10),
    icon: "OP",
    iconBg: "bg-indigo-100 text-indigo-700",
    category: "Real Estate",
    categories: ["Real Estate", "Growth"],
    marketCap: "$2.8B",
    address: "0x756bfd9186E108fa53D9a972836D009C2CB887cf",
    chainId: 8453, // Base
  },
  {
    id: "11",
    ticker: "ONDS",
    name: "Ondas Holdings Inc.",
    price: 3.12,
    change24h: 0.08,
    change24hPercent: 2.63,
    sparklineData: generateSparkline(3.04, 2.63, 24, 11),
    icon: "ON",
    iconBg: "bg-orange-100 text-orange-700",
    category: "Technology",
    categories: ["Technology", "Small Cap"],
    marketCap: "$0.3B",
    address: "0xC11E33c52dac4B95b4E4B85dC67B365e1c667cBC",
    chainId: 8453, // Base
  },
  {
    id: "12",
    ticker: "META",
    name: "Meta Platforms Inc.",
    price: 498.42,
    change24h: 6.87,
    change24hPercent: 1.4,
    sparklineData: generateSparkline(491.55, 1.4, 24, 12),
    icon: "ME",
    iconBg: "bg-fuchsia-100 text-fuchsia-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$1.4T",
    address: "0xD7A2f948f846c23Fd34cf380F828638E7d818b5b",
    chainId: 8453, // Base
  },
  {
    id: "13",
    ticker: "NFLX",
    name: "Netflix Inc.",
    price: 690.34,
    change24h: -9.45,
    change24hPercent: -1.35,
    sparklineData: generateSparkline(699.79, -1.35, 24, 13),
    icon: "NF",
    iconBg: "bg-red-100 text-red-700",
    category: "Consumer",
    categories: ["Consumer", "Large Cap", "Growth"],
    marketCap: "$300B",
    address: "0x9e2B9B0B2303A58DFd4aEB049D77c81C8DeF2e04",
    chainId: 8453, // Base
  },
  {
    id: "14",
    ticker: "AMD",
    name: "Advanced Micro Devices Inc.",
    price: 172.18,
    change24h: -4.12,
    change24hPercent: -2.33,
    sparklineData: generateSparkline(176.3, -2.33, 24, 14),
    icon: "AD",
    iconBg: "bg-purple-100 text-purple-700",
    category: "Technology",
    categories: ["Technology", "Large Cap", "Growth"],
    marketCap: "$270B",
    address: "0x8fc8083235E4C0bf978feD1AfE4A317B94c2Ef77",
    chainId: 8453, // Base
  },
  {
    id: "15",
    ticker: "JPM",
    name: "JPMorgan Chase & Co.",
    price: 246.93,
    change24h: 3.84,
    change24hPercent: 1.58,
    sparklineData: generateSparkline(243.09, 1.58, 24, 15),
    icon: "JP",
    iconBg: "bg-cyan-100 text-cyan-800",
    category: "Financials",
    categories: ["Financials", "Large Cap", "Value"],
    marketCap: "$455B",
    address: "0x51Cb9012AE16812586c7c9D6B6D13103124873D1",
    chainId: 8453, // Base
  },
]

// Mark a few as newly added for the Newly Added column
ASSETS[10].addedDate = "2 days ago" // ONDS
ASSETS[11].addedDate = "3 days ago" // META
ASSETS[12].addedDate = "5 days ago" // NFLX
ASSETS[13].addedDate = "1 week ago" // AMD
ASSETS[14].addedDate = "1 week ago" // JPM

export function getAssetByTicker(ticker: string): AssetData | undefined {
  return ASSETS.find((a) => a.ticker.toLowerCase() === ticker.toLowerCase())
}

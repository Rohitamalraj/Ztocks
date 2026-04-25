export const ZK_VERIFIER_ABI = [
  {
    name: "submitProof",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "a",          type: "uint256[2]"    },
      { name: "b",          type: "uint256[2][2]" },
      { name: "c",          type: "uint256[2]"    },
      { name: "pubSignals", type: "uint256[6]"    },
    ],
    outputs: [],
  },
  {
    name: "isVerified",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getTier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "tier",   type: "uint8" },
      { name: "expiry", type: "uint256" },
    ],
  },
  {
    name: "TierVerified",
    type: "event",
    inputs: [
      { name: "user",   type: "address", indexed: true },
      { name: "tier",   type: "uint8",   indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
] as const;

export const TIER_MANAGER_ABI = [
  {
    name: "getMaxLeverage",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tier", type: "uint8" }],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const SYNTH_VAULT_ABI = [
  {
    name: "openPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "synthToken",     type: "address" },
      { name: "isLong",         type: "bool" },
      { name: "collateralUSDC", type: "uint256" },
      { name: "leverage",       type: "uint256" },
      { name: "executionPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "closePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "executionPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getUserPositions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "asset",          type: "address" },
          { name: "isLong",         type: "bool" },
          { name: "collateralUSDC", type: "uint256" },
          { name: "leverage",       type: "uint8" },
          { name: "entryPrice",     type: "uint256" },
          { name: "synthAmount",    type: "uint256" },
          { name: "openTime",       type: "uint256" },
          { name: "isOpen",         type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getHealthFactor",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user",  type: "address" },
      { name: "index", type: "uint256" },
      { name: "currentPrice", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPositionCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isRegisteredAsset",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "PositionOpened",
    type: "event",
    inputs: [
      { name: "user",           type: "address", indexed: true },
      { name: "positionId",     type: "uint256", indexed: true },
      { name: "asset",          type: "address", indexed: true },
      { name: "isLong",         type: "bool",    indexed: false },
      { name: "collateralUSDC", type: "uint256", indexed: false },
      { name: "leverage",       type: "uint8",   indexed: false },
      { name: "entryPrice",     type: "uint256", indexed: false },
      { name: "synthAmount",    type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionClosed",
    type: "event",
    inputs: [
      { name: "user",         type: "address", indexed: true },
      { name: "positionId",   type: "uint256", indexed: true },
      { name: "exitPrice",    type: "uint256", indexed: false },
      { name: "pnl",          type: "int256",  indexed: false },
      { name: "returnedUSDC", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MOCK_TOKEN_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const FEE_MODULE_ABI = [
  {
    name: "feeToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

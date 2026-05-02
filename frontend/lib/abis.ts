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
    name: "getMaxLeverage",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tier", type: "uint8" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "userTier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "userProofExpiry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
      { name: "encIsLong",         type: "bytes32" },
      { name: "encCollateralUSDC", type: "bytes32" },
      { name: "encLeverage",       type: "bytes32" },
      { name: "encExecutionPrice", type: "bytes32" },
      { name: "inputProof",        type: "bytes" },
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
          { name: "isLong",         type: "bytes32" },
          { name: "collateralUSDC", type: "bytes32" },
          { name: "leverage",       type: "bytes32" },
          { name: "entryPrice",     type: "bytes32" },
          { name: "synthAmount",    type: "bytes32" },
          { name: "openTime",       type: "uint256" },
          { name: "isOpen",         type: "bool" },
        ],
      },
    ],
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
      { name: "openTime",       type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionClosed",
    type: "event",
    inputs: [
      { name: "user",         type: "address", indexed: true },
      { name: "positionId",   type: "uint256", indexed: true },
      { name: "closeTime",    type: "uint256", indexed: false },
    ],
  },
] as const;

export const CUSDC_ABI = [
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "wrappedAmountSent", type: "bytes32" }],
  },
  {
    name: "unwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "unwrapRequestId", type: "bytes32" }],
  },
  {
    name: "finalizeUnwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "unwrapRequestId", type: "bytes32" },
      { name: "unwrapAmountCleartext", type: "uint64" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "UnwrapRequested",
    type: "event",
    inputs: [
      { name: "receiver", type: "address", indexed: true },
      { name: "unwrapRequestId", type: "bytes32", indexed: true },
      { name: "amount", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "setOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
  {
    name: "isOperator",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "underlying",
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

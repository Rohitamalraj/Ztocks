import type { AssetSymbol } from "@/hooks/use-mock-prices";

export const CONTRACTS = {
  // ─── ZK Identity ───────────────────────────────────────────────────────────
  ZKVerifier:    process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS    || "",
  TierManager:   process.env.NEXT_PUBLIC_TIER_MANAGER_ADDRESS   || "",
  // ─── Core protocol ─────────────────────────────────────────────────────────
  SynthVault:    process.env.NEXT_PUBLIC_SYNTH_VAULT_ADDRESS    || "",
  FeeModule:     process.env.NEXT_PUBLIC_FEE_MODULE_ADDRESS     || "",
  MockUSDC:      process.env.NEXT_PUBLIC_USDC_ADDRESS           || "",
  MockFeeToken:  process.env.NEXT_PUBLIC_FEE_TOKEN_ADDRESS      || "",
  sAAPL:         process.env.NEXT_PUBLIC_SAAPL_ADDRESS          || "",
  sTSLA:         process.env.NEXT_PUBLIC_STSLA_ADDRESS          || "",
  sNVDA:         process.env.NEXT_PUBLIC_SNVDA_ADDRESS          || "",
  sSPY:          process.env.NEXT_PUBLIC_SSPY_ADDRESS           || "",
  sAMZN:        process.env.NEXT_PUBLIC_SAMZN_ADDRESS          || "",
  sMSFT:         process.env.NEXT_PUBLIC_SMSFT_ADDRESS          || "",
  sMETA:         process.env.NEXT_PUBLIC_SMETA_ADDRESS          || "",
  sNFLX:         process.env.NEXT_PUBLIC_SNFLX_ADDRESS          || "",
  sAMD:          process.env.NEXT_PUBLIC_SAMD_ADDRESS           || "",
};

export const ASSET_TOKENS: Record<AssetSymbol, `0x${string}`> = {
  sAAPL: CONTRACTS.sAAPL as `0x${string}`,
  sTSLA: CONTRACTS.sTSLA as `0x${string}`,
  sNVDA: CONTRACTS.sNVDA as `0x${string}`,
  sSPY:  CONTRACTS.sSPY  as `0x${string}`,
  sAMZN: CONTRACTS.sAMZN as `0x${string}`,
  sMSFT: CONTRACTS.sMSFT as `0x${string}`,
  sMETA: CONTRACTS.sMETA as `0x${string}`,
  sNFLX: CONTRACTS.sNFLX as `0x${string}`,
  sAMD:  CONTRACTS.sAMD  as `0x${string}`,
};

export const TOKEN_SYMBOL: Record<string, AssetSymbol> = {
  [CONTRACTS.sAAPL.toLowerCase()]: "sAAPL",
  [CONTRACTS.sTSLA.toLowerCase()]: "sTSLA",
  [CONTRACTS.sNVDA.toLowerCase()]: "sNVDA",
  [CONTRACTS.sSPY.toLowerCase()]:  "sSPY",
  [CONTRACTS.sAMZN.toLowerCase()]: "sAMZN",
  [CONTRACTS.sMSFT.toLowerCase()]: "sMSFT",
  [CONTRACTS.sMETA.toLowerCase()]: "sMETA",
  [CONTRACTS.sNFLX.toLowerCase()]: "sNFLX",
  [CONTRACTS.sAMD.toLowerCase()]:  "sAMD",
};

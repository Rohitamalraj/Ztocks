import type { AssetSymbol } from "@/hooks/use-mock-prices";

export const CONTRACTS = {
  // ─── ZK Identity ───────────────────────────────────────────────────────────
  ZKVerifier:    process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS    || "",
  TierManager:   process.env.NEXT_PUBLIC_TIER_MANAGER_ADDRESS   || "",
  // ─── Core protocol ─────────────────────────────────────────────────────────
  SynthVault:    process.env.NEXT_PUBLIC_SYNTH_VAULT_ADDRESS    || "",
  FeeModule:     process.env.NEXT_PUBLIC_FEE_MODULE_ADDRESS     || "",
  USDC:          process.env.NEXT_PUBLIC_USDC_ADDRESS           || "",
  CUSDC:         process.env.NEXT_PUBLIC_CUSDC_ADDRESS          || "",
  FeeToken:      process.env.NEXT_PUBLIC_FEE_TOKEN_ADDRESS      || "",
  csAAPL:        process.env.NEXT_PUBLIC_CSAAPL_ADDRESS         || "",
  csTSLA:        process.env.NEXT_PUBLIC_CSTSLA_ADDRESS         || "",
  csNVDA:        process.env.NEXT_PUBLIC_CSNVDA_ADDRESS         || "",
  csSPY:         process.env.NEXT_PUBLIC_CSSPY_ADDRESS          || "",
  csAMZN:        process.env.NEXT_PUBLIC_CSAMZN_ADDRESS         || "",
  csMSFT:        process.env.NEXT_PUBLIC_CSMSFT_ADDRESS         || "",
  csMETA:        process.env.NEXT_PUBLIC_CSMETA_ADDRESS         || "",
  csNFLX:        process.env.NEXT_PUBLIC_CSNFLX_ADDRESS         || "",
  csAMD:         process.env.NEXT_PUBLIC_CSAMD_ADDRESS          || "",
};

export const ASSET_TOKENS: Record<AssetSymbol, `0x${string}`> = {
  sAAPL: CONTRACTS.csAAPL as `0x${string}`,
  sTSLA: CONTRACTS.csTSLA as `0x${string}`,
  sNVDA: CONTRACTS.csNVDA as `0x${string}`,
  sSPY:  CONTRACTS.csSPY  as `0x${string}`,
  sAMZN: CONTRACTS.csAMZN as `0x${string}`,
  sMSFT: CONTRACTS.csMSFT as `0x${string}`,
  sMETA: CONTRACTS.csMETA as `0x${string}`,
  sNFLX: CONTRACTS.csNFLX as `0x${string}`,
  sAMD:  CONTRACTS.csAMD  as `0x${string}`,
};

export const TOKEN_SYMBOL: Record<string, AssetSymbol> = {
  [CONTRACTS.csAAPL.toLowerCase()]: "sAAPL",
  [CONTRACTS.csTSLA.toLowerCase()]: "sTSLA",
  [CONTRACTS.csNVDA.toLowerCase()]: "sNVDA",
  [CONTRACTS.csSPY.toLowerCase()]:  "sSPY",
  [CONTRACTS.csAMZN.toLowerCase()]: "sAMZN",
  [CONTRACTS.csMSFT.toLowerCase()]: "sMSFT",
  [CONTRACTS.csMETA.toLowerCase()]: "sMETA",
  [CONTRACTS.csNFLX.toLowerCase()]: "sNFLX",
  [CONTRACTS.csAMD.toLowerCase()]:  "sAMD",
};

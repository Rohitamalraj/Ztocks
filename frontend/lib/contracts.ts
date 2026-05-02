import type { AssetSymbol } from "@/hooks/use-asset-quotes";
import sepoliaDefaults from "@/lib/sepolia-defaults.json";

const D = sepoliaDefaults as {
  underlyingUSDC: string;
  ConfidentialUSDC: string;
  ZKVerifier: string;
  ConfidentialTierManager: string;
  ConfidentialSynthVaultFHE: string;
  tokens: Record<string, string>;
};

/** Env wins; otherwise bundled Sepolia deployment (update `sepolia-defaults.json` after redeploy). */
export const CONTRACTS = {
  ZKVerifier:  process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS || D.ZKVerifier || "",
  TierManager: process.env.NEXT_PUBLIC_TIER_MANAGER_ADDRESS || D.ConfidentialTierManager || "",
  SynthVault:  process.env.NEXT_PUBLIC_SYNTH_VAULT_ADDRESS || D.ConfidentialSynthVaultFHE || "",
  USDC:        process.env.NEXT_PUBLIC_USDC_ADDRESS || D.underlyingUSDC || "",
  CUSDC:       process.env.NEXT_PUBLIC_CUSDC_ADDRESS || D.ConfidentialUSDC || "",
  csAAPL:      process.env.NEXT_PUBLIC_CSAAPL_ADDRESS || D.tokens.csAAPL || "",
  csTSLA:      process.env.NEXT_PUBLIC_CSTSLA_ADDRESS || D.tokens.csTSLA || "",
  csNVDA:      process.env.NEXT_PUBLIC_CSNVDA_ADDRESS || D.tokens.csNVDA || "",
  csSPY:       process.env.NEXT_PUBLIC_CSSPY_ADDRESS || D.tokens.csSPY || "",
  csAMZN:      process.env.NEXT_PUBLIC_CSAMZN_ADDRESS || D.tokens.csAMZN || "",
  csMSFT:      process.env.NEXT_PUBLIC_CSMSFT_ADDRESS || D.tokens.csMSFT || "",
  csMETA:      process.env.NEXT_PUBLIC_CSMETA_ADDRESS || D.tokens.csMETA || "",
  csNFLX:      process.env.NEXT_PUBLIC_CSNFLX_ADDRESS || D.tokens.csNFLX || "",
  csAMD:       process.env.NEXT_PUBLIC_CSAMD_ADDRESS || D.tokens.csAMD || "",
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

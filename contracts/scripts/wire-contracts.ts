import { ethers } from "hardhat";

/**
 * Finish post-deployment wiring:
 * - setVault on each ConfidentialSynthToken
 * - registerSynthAsset on vault
 * 
 * Run: npx hardhat run scripts/wire-contracts.ts --network sepolia
 */

const DEPLOYMENT = {
  ZKVerifier:               "0x1f8c9C347CFbb0FfdE6418090490e7c1831911AC",
  ConfidentialTierManager:  "0x8F87A3c16F1F2940332f1F63e8673fbF14C8399c",
  ConfidentialUSDC:         "0xFaD94068212fbc5084911381DBF983B085BBD692",
  ConfidentialSynthVaultFHE:"0x727182db83ae5518834aBA13185192c6f51c1E8F",
  tokens: {
    csAAPL: "0x7e5af876AdcF3e7f6644B1bdA81033Ff34db431A",
    csTSLA: "0xd57aCc2D31BE3F5af792D2aeC3B8A2EF98b115c7",
    csNVDA: "0xA52AD42C0108E9A6A11D87d66E7843AA7b9Ba40C",
    csSPY:  "0x0b35B5cFEAfcF53Cd762F80aaA0f54Bd851C86cc",
    csAMZN: "0x81608Eb867B9EE8A0d2e873A53A4226B71e86BA5",
    csMSFT: "0xfc18278cC136F153c1b6564eF9a56F857a62e29C",
    csMETA: "0x6211118fACEE629649eBf3aD278221A54A3ffD3f",
    csNFLX: "0x42a551B41E6B0113EDCA46E08FBb6033f29d7A49",
    csAMD:  "0xbcCE02d285E191eCA77456a5887eAA9111E23fb0",
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Wiring with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const vaultAddr = DEPLOYMENT.ConfidentialSynthVaultFHE;

  // 1. setVault on each ConfidentialSynthToken
  console.log("1. Setting vault on each SynthToken...");
  for (const [symbol, tokenAddr] of Object.entries(DEPLOYMENT.tokens)) {
    try {
      const token = await ethers.getContractAt("ConfidentialSynthToken", tokenAddr);
      
      // Check if vault already set to avoid revert
      const currentVault = await token.vault();
      if (currentVault.toLowerCase() === vaultAddr.toLowerCase()) {
        console.log(`   ${symbol}: already set ✓`);
        continue;
      }
      
      const tx = await token.setVault(vaultAddr);
      await tx.wait();
      console.log(`   ${symbol}: setVault ✓`);
    } catch (e: any) {
      console.warn(`   ${symbol}: ${e.message?.slice(0, 80)}`);
    }
  }

  // 2. registerSynthAsset on vault
  console.log("\n2. Registering synth assets on vault...");
  const vault = await ethers.getContractAt("ConfidentialSynthVaultFHE", vaultAddr);
  for (const [symbol, tokenAddr] of Object.entries(DEPLOYMENT.tokens)) {
    try {
      const isRegistered = await vault.isRegisteredAsset(tokenAddr);
      if (isRegistered) {
        console.log(`   ${symbol}: already registered ✓`);
        continue;
      }
      const tx = await vault.registerSynthAsset(tokenAddr);
      await tx.wait();
      console.log(`   ${symbol}: registered ✓`);
    } catch (e: any) {
      console.warn(`   ${symbol}: ${e.message?.slice(0, 80)}`);
    }
  }

  console.log("\n✓ All wiring complete!");
  console.log("\n─── Final contract addresses ─────────────────────────────────");
  console.log(`NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=${DEPLOYMENT.ZKVerifier}`);
  console.log(`NEXT_PUBLIC_TIER_MANAGER_ADDRESS=${DEPLOYMENT.ConfidentialTierManager}`);
  console.log(`NEXT_PUBLIC_CUSDC_ADDRESS=${DEPLOYMENT.ConfidentialUSDC}`);
  console.log(`NEXT_PUBLIC_SYNTH_VAULT_ADDRESS=${DEPLOYMENT.ConfidentialSynthVaultFHE}`);
  for (const [symbol, addr] of Object.entries(DEPLOYMENT.tokens)) {
    console.log(`NEXT_PUBLIC_${symbol.toUpperCase()}_ADDRESS=${addr}`);
  }
  console.log("─────────────────────────────────────────────────────────────");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

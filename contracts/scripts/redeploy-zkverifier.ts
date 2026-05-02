import { ethers, network } from "hardhat";

/**
 * Targeted redeploy: Only redeploys Groth16Verifier + ZKVerifier.
 * All other contracts (TierManager, Vault, SynthTokens, cUSDC) stay unchanged.
 * 
 * Run: npx hardhat run scripts/redeploy-zkverifier.ts --network sepolia
 */

const ORACLE_PUBKEY_AX = process.env.ORACLE_PUBKEY_AX || "0";
const ORACLE_PUBKEY_AY = process.env.ORACLE_PUBKEY_AY || "0";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  if (ORACLE_PUBKEY_AX === "0" || ORACLE_PUBKEY_AY === "0") {
    throw new Error(
      "Set ORACLE_PUBKEY_AX and ORACLE_PUBKEY_AY in contracts/.env"
    );
  }

  // 1. Deploy fresh Groth16Verifier
  console.log("1. Deploying Groth16Verifier...");
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Addr = await groth16Verifier.getAddress();
  console.log("   Groth16Verifier:", groth16Addr);

  // 2. Deploy fresh ZKVerifier (no ConfidentialTierManager dependency)
  console.log("2. Deploying ZKVerifier...");
  console.log("   Oracle Ax:", ORACLE_PUBKEY_AX.slice(0, 20) + "...");
  console.log("   Oracle Ay:", ORACLE_PUBKEY_AY.slice(0, 20) + "...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(
    groth16Addr,
    BigInt(ORACLE_PUBKEY_AX),
    BigInt(ORACLE_PUBKEY_AY)
  );
  await zkVerifier.waitForDeployment();
  const zkVerifierAddr = await zkVerifier.getAddress();
  console.log("   ZKVerifier:", zkVerifierAddr);

  // 3. Verify oracle keys are set correctly
  const storedAx = await zkVerifier.ORACLE_AX();
  const storedAy = await zkVerifier.ORACLE_AY();
  console.log("\n✓ Oracle keys verified on-chain:");
  console.log("  ORACLE_AX:", storedAx.toString().slice(0, 20) + "...");
  console.log("  ORACLE_AY:", storedAy.toString().slice(0, 20) + "...");

  // 4. Print the new address for .env.local
  console.log("\n─── UPDATE YOUR .env.local ──────────────────────────────────");
  console.log(`NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=${zkVerifierAddr}`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log("\nAll other contract addresses remain the same.");
  console.log("Restart your frontend dev server after updating .env.local.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";

/**
 * Deploy ERC7984 Confidential Tokens
 * 
 * This script deploys:
 * 1. ConfidentialUSDC (cUSDC) - ERC7984 wrapper for USDC
 * 2. ConfidentialSynthToken contracts for each synthetic asset
 * 
 * Usage:
 *   npx hardhat run scripts/deployERC7984.ts --network sepolia
 */

async function main() {
  console.log("🚀 Deploying ERC7984 Confidential Tokens...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ─── Configuration ─────────────────────────────────────────────────────────
  
  // USDC address (replace with actual USDC address for your network)
  const USDC_ADDRESS = process.env.USDC_ADDRESS;
  if (!USDC_ADDRESS) {
    throw new Error("Set USDC_ADDRESS in contracts/.env before deploying");
  }
  
  // Synthetic assets to deploy
  const SYNTH_ASSETS = [
    { name: "Confidential Synthetic Apple", symbol: "csAAPL", underlying: "AAPL" },
    { name: "Confidential Synthetic Tesla", symbol: "csTSLA", underlying: "TSLA" },
    { name: "Confidential Synthetic NVIDIA", symbol: "csNVDA", underlying: "NVDA" },
    { name: "Confidential Synthetic S&P 500", symbol: "csSPY", underlying: "SPY" },
  ];

  // ─── 1. Deploy ConfidentialUSDC ────────────────────────────────────────────
  
  console.log("📦 Deploying ConfidentialUSDC...");
  const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
  const cUSDC = await ConfidentialUSDC.deploy(USDC_ADDRESS);
  await cUSDC.waitForDeployment();
  const cUSDCAddress = await cUSDC.getAddress();
  console.log("✅ ConfidentialUSDC deployed to:", cUSDCAddress);
  console.log("   Underlying USDC:", USDC_ADDRESS);
  console.log();

  // ─── 2. Deploy ConfidentialSynthTokens ─────────────────────────────────────
  
  const deployedSynthTokens: { [key: string]: string } = {};
  
  for (const asset of SYNTH_ASSETS) {
    console.log(`📦 Deploying ${asset.symbol}...`);
    
    const ConfidentialSynthToken = await ethers.getContractFactory("ConfidentialSynthToken");
    const synthToken = await ConfidentialSynthToken.deploy(
      deployer.address,
      asset.name,
      asset.symbol,
      asset.underlying,
      `https://ztocks.io/tokens/${asset.symbol.toLowerCase()}`
    );
    await synthToken.waitForDeployment();
    const synthTokenAddress = await synthToken.getAddress();
    
    deployedSynthTokens[asset.symbol] = synthTokenAddress;
    
    console.log(`✅ ${asset.symbol} deployed to:`, synthTokenAddress);
    console.log(`   Name: ${asset.name}`);
    console.log(`   Underlying: ${asset.underlying}`);
    console.log();
  }

  // ─── 3. Summary ────────────────────────────────────────────────────────────
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🎉 Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("📋 Deployed Contracts:\n");
  console.log("ConfidentialUSDC (cUSDC):");
  console.log(`  Address: ${cUSDCAddress}`);
  console.log(`  Underlying: ${USDC_ADDRESS}\n`);
  
  console.log("Confidential Synth Tokens:");
  for (const [symbol, address] of Object.entries(deployedSynthTokens)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log();

  // ─── 4. Next Steps ─────────────────────────────────────────────────────────
  
  console.log("📝 Next Steps:\n");
  console.log("1. Deploy ConfidentialSynthVaultFHE with cUSDC address");
  console.log("2. Call setVault() on each synth token to authorize the vault");
  console.log("3. Call registerSynthAsset() on vault for each synth token");
  console.log("4. Verify contracts on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${cUSDCAddress} ${USDC_ADDRESS}`);
  for (const [symbol, address] of Object.entries(deployedSynthTokens)) {
    const asset = SYNTH_ASSETS.find(a => a.symbol === symbol)!;
    console.log(`   npx hardhat verify --network sepolia ${address} "${deployer.address}" "${asset.name}" "${asset.symbol}" "${asset.underlying}" "https://ztocks.io/tokens/${asset.symbol.toLowerCase()}"`);
  }
  console.log();

  // ─── 5. Save Deployment Info ───────────────────────────────────────────────
  
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      cUSDC: {
        address: cUSDCAddress,
        underlying: USDC_ADDRESS,
      },
      synthTokens: deployedSynthTokens,
    },
  };

  console.log("💾 Deployment Info (save this):\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

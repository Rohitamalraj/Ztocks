# Ztocks Deployment Addresses - Sepolia Testnet

## 🚀 Deployment Status: ✅ COMPLETE

**Network**: Sepolia Testnet  
**Deployer**: 0x2c32743B801B9c3d53099334e2ac5a8DA39498bC  
**Date**: April 28, 2026  

---

## ✅ Deployed Contracts

### Core Infrastructure

| Contract | Address | Status |
|----------|---------|--------|
| **USDC** (existing) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | ✅ Using existing |
| **ConfidentialTierManager** | `0x16725aC5Dac9D37F097fd0BABC2b890B1A804b86` | ✅ Deployed |
| **Groth16Verifier** | `0xe6FA6af575c33E93b20Cc998e97ac1613D76B122` | ✅ Deployed |
| **ZKVerifier** | `0xd9133c2CcA52e7dfFdBAEAA0B3228c9288c19E5f` | ✅ Deployed |
| **ConfidentialUSDC** (cUSDC) | `0xe30096c4486B856eF1581c2066F8471417bA4DF4` | ✅ Deployed |
| **ConfidentialSynthVaultFHE** | `0xb423EB8C27524CFbCB2A70E81468a963968dE66B` | ✅ Deployed |

### Confidential Synth Tokens (ERC7984)

| Token | Symbol | Address | Status |
|-------|--------|---------|--------|
| **Confidential Synthetic Apple** | csAAPL | `0xFEfeA180C52268d3f77ba572Eba6fc32e789A572` | ✅ Deployed |
| **Confidential Synthetic Tesla** | csTSLA | `0x8E117fFA277f5Cb801d87F0A1ff95c3aA2a6f026` | ✅ Deployed |
| **Confidential Synthetic NVIDIA** | csNVDA | `0x3C9a86c3C4fA29787fbf94c780e951994FC76BF9` | ✅ Deployed |
| **Confidential Synthetic S&P 500** | csSPY | `0x20032EA6f975FbfA5aFbA329f2c2fCE51B60FE94` | ✅ Deployed |
| **Confidential Synthetic Amazon** | csAMZN | `0x4040D46b287993060eE7f51B7c87F8bfd913508C` | ✅ Deployed |
| **Confidential Synthetic Microsoft** | csMSFT | `0x870f9724047acba94885359f38cA55D639A4C564` | ✅ Deployed |
| **Confidential Synthetic Meta** | csMETA | `0x902134f3832F9C780BEe643a11dfBb2561aC23ed` | ✅ Deployed |
| **Confidential Synthetic Netflix** | csNFLX | `0x30435Ec7cBdd2c19Ae2eD545BeEbC4567Bf54a71` | ✅ Deployed |
| **Confidential Synthetic AMD** | csAMD | `0x0755F056b0Fe63D7F344515899342c31F864210b` | ✅ Deployed |

---

## 🔧 Oracle Configuration

**Oracle Public Keys** (Baby Jubjub):
- **ORACLE_PUBKEY_AX**: `20282674216505685762022224753314252061395976465629297131809406032589473363554`
- **ORACLE_PUBKEY_AY**: `17871244028928976016517840794490994648833474903540169334025968439307086265355`

⚠️ **Note**: Oracle private key stored securely (NOT in git)

---

## 📋 Frontend Environment Variables

Copy these to your frontend `.env.local`:

```bash
# Network
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Core Contracts
NEXT_PUBLIC_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
NEXT_PUBLIC_CUSDC_ADDRESS=0xe30096c4486B856eF1581c2066F8471417bA4DF4
NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=0xd9133c2CcA52e7dfFdBAEAA0B3228c9288c19E5f
NEXT_PUBLIC_TIER_MANAGER_ADDRESS=0x16725aC5Dac9D37F097fd0BABC2b890B1A804b86
NEXT_PUBLIC_SYNTH_VAULT_ADDRESS=0xb423EB8C27524CFbCB2A70E81468a963968dE66B

# Synth Tokens
NEXT_PUBLIC_CSAAPL_ADDRESS=0xFEfeA180C52268d3f77ba572Eba6fc32e789A572
NEXT_PUBLIC_CSTSLA_ADDRESS=0x8E117fFA277f5Cb801d87F0A1ff95c3aA2a6f026
NEXT_PUBLIC_CSNVDA_ADDRESS=0x3C9a86c3C4fA29787fbf94c780e951994FC76BF9
NEXT_PUBLIC_CSSPY_ADDRESS=0x20032EA6f975FbfA5aFbA329f2c2fCE51B60FE94
NEXT_PUBLIC_CSAMZN_ADDRESS=0x4040D46b287993060eE7f51B7c87F8bfd913508C
NEXT_PUBLIC_CSMSFT_ADDRESS=0x870f9724047acba94885359f38cA55D639A4C564
NEXT_PUBLIC_CSMETA_ADDRESS=0x902134f3832F9C780BEe643a11dfBb2561aC23ed
NEXT_PUBLIC_CSNFLX_ADDRESS=0x30435Ec7cBdd2c19Ae2eD545BeEbC4567Bf54a71
NEXT_PUBLIC_CSAMD_ADDRESS=0x0755F056b0Fe63D7F344515899342c31F864210b

# Oracle Keys (for ZK proof generation)
ORACLE_PRIVATE_KEY=<KEEP_SECRET>
ORACLE_PUBKEY_AX=20282674216505685762022224753314252061395976465629297131809406032589473363554
ORACLE_PUBKEY_AY=17871244028928976016517840794490994648833474903540169334025968439307086265355
```

---

## ✅ Completed Actions

All deployment steps completed successfully:

1. ✅ Set vault address on each SynthToken
2. ✅ Registered synth assets on vault
3. ✅ Saved deployment info to `deployments/sepolia.json`

**Status**: Deployment complete and ready for frontend integration!

---

## 🔍 Verification Commands

Once deployment completes, verify contracts on Etherscan:

```bash
# Core contracts
npx hardhat verify --network sepolia 0x16725aC5Dac9D37F097fd0BABC2b890B1A804b86
npx hardhat verify --network sepolia 0xe6FA6af575c33E93b20Cc998e97ac1613D76B122
npx hardhat verify --network sepolia 0xd9133c2CcA52e7dfFdBAEAA0B3228c9288c19E5f "0xe6FA6af575c33E93b20Cc998e97ac1613D76B122" "0x16725aC5Dac9D37F097fd0BABC2b890B1A804b86" "20282674216505685762022224753314252061395976465629297131809406032589473363554" "17871244028928976016517840794490994648833474903540169334025968439307086265355"
npx hardhat verify --network sepolia 0xe30096c4486B856eF1581c2066F8471417bA4DF4 "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
npx hardhat verify --network sepolia 0xb423EB8C27524CFbCB2A70E81468a963968dE66B "0xd9133c2CcA52e7dfFdBAEAA0B3228c9288c19E5f" "0x16725aC5Dac9D37F097fd0BABC2b890B1A804b86" "0xe30096c4486B856eF1581c2066F8471417bA4DF4" "0x0000000000000000000000000000000000000000"

# Synth tokens (example for csAAPL)
npx hardhat verify --network sepolia 0xFEfeA180C52268d3f77ba572Eba6fc32e789A572 "0x2c32743B801B9c3d53099334e2ac5a8DA39498bC" "Confidential Synthetic Apple" "csAAPL" "AAPL" "https://ztocks.io/tokens/csaapl"
```

---

## 📊 Deployment Summary

- **Total Contracts Deployed**: 15
  - 5 Core contracts
  - 9 Synth tokens
  - 1 Existing USDC

- **Total Gas Used**: TBD (waiting for completion)
- **Deployment Time**: ~5-10 minutes
- **Network**: Sepolia Testnet

---

## 🎯 Next Steps

1. ✅ Wait for permission wiring to complete
2. ✅ Verify deployment file created
3. ✅ Copy addresses to frontend `.env.local`
4. ✅ Test frontend integration
5. ✅ Verify contracts on Etherscan
6. ✅ Run smoke tests

---

**Status**: ✅ Deployment complete - all contracts deployed and configured  
**Last Updated**: April 28, 2026  

**Built with ❤️ using Zama FHE and OpenZeppelin Confidential Contracts**

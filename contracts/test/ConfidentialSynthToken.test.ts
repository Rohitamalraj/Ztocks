import { expect } from "chai";
import { ethers } from "hardhat";
import { ConfidentialSynthToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * ConfidentialSynthToken Tests
 * 
 * Tests for ERC7984 confidential synthetic tokens.
 * 
 * NOTE: Full FHE testing requires fhevmjs SDK and a running FHE coprocessor.
 * These tests focus on contract logic and access control.
 * For full encryption/decryption tests, see integration tests.
 */

describe("ConfidentialSynthToken", function () {
  let token: ConfidentialSynthToken;
  let owner: SignerWithAddress;
  let vault: SignerWithAddress;
  let user: SignerWithAddress;
  let other: SignerWithAddress;

  const TOKEN_NAME = "Confidential Synthetic Apple";
  const TOKEN_SYMBOL = "csAAPL";
  const UNDERLYING = "AAPL";
  const TOKEN_URI = "https://ztocks.io/tokens/csaapl";

  beforeEach(async function () {
    [owner, vault, user, other] = await ethers.getSigners();

    // Deploy ConfidentialSynthToken
    const ConfidentialSynthToken = await ethers.getContractFactory("ConfidentialSynthToken");
    token = await ConfidentialSynthToken.deploy(
      owner.address,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      UNDERLYING,
      TOKEN_URI
    );
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("should set the correct underlying asset", async function () {
      expect(await token.underlyingAsset()).to.equal(UNDERLYING);
    });

    it("should set the correct owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("should not have a vault set initially", async function () {
      expect(await token.vault()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Vault Management", function () {
    it("should allow owner to set vault", async function () {
      await expect(token.connect(owner).setVault(vault.address))
        .to.emit(token, "VaultSet")
        .withArgs(vault.address);

      expect(await token.vault()).to.equal(vault.address);
    });

    it("should revert if non-owner tries to set vault", async function () {
      await expect(token.connect(user).setVault(vault.address))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should revert if vault is already set", async function () {
      await token.connect(owner).setVault(vault.address);

      await expect(token.connect(owner).setVault(other.address))
        .to.be.revertedWithCustomError(token, "VaultAlreadySet");
    });

    it("should revert if vault address is zero", async function () {
      await expect(token.connect(owner).setVault(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(token, "ZeroAddress");
    });
  });

  describe("Minting (Access Control)", function () {
    beforeEach(async function () {
      // Set vault
      await token.connect(owner).setVault(vault.address);
    });

    it.skip("should revert if non-vault tries to mint (requires FHE setup)", async function () {
      // Note: This test requires fhevmjs to create proper encrypted inputs
      // Skipped in unit tests, covered in integration tests
    });

    it.skip("should revert if owner tries to mint (requires FHE setup)", async function () {
      // Note: This test requires fhevmjs to create proper encrypted inputs
      // Skipped in unit tests, covered in integration tests
    });

    // Note: Actual minting test requires FHE setup
    // See integration tests for full FHE testing
  });

  describe("Burning (Access Control)", function () {
    beforeEach(async function () {
      await token.connect(owner).setVault(vault.address);
    });

    it.skip("should revert if non-vault tries to burn (requires FHE setup)", async function () {
      // Note: This test requires fhevmjs to create proper encrypted inputs
      // Skipped in unit tests, covered in integration tests
    });

    it.skip("should revert if owner tries to burn (requires FHE setup)", async function () {
      // Note: This test requires fhevmjs to create proper encrypted inputs
      // Skipped in unit tests, covered in integration tests
    });
  });

  describe("Ownership Transfer", function () {
    it("should allow owner to transfer ownership (2-step)", async function () {
      // Step 1: Transfer ownership
      await token.connect(owner).transferOwnership(user.address);
      expect(await token.owner()).to.equal(owner.address); // Still old owner

      // Step 2: Accept ownership
      await token.connect(user).acceptOwnership();
      expect(await token.owner()).to.equal(user.address); // Now new owner
    });

    it("should revert if non-pending-owner tries to accept", async function () {
      await token.connect(owner).transferOwnership(user.address);

      await expect(token.connect(other).acceptOwnership())
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC7984 Interface", function () {
    it("should support ERC7984 interface", async function () {
      // ERC7984 interface ID: 0x4958f2a4
      const ERC7984_INTERFACE_ID = "0x4958f2a4";
      expect(await token.supportsInterface(ERC7984_INTERFACE_ID)).to.be.true;
    });

    it("should support ERC165 interface", async function () {
      // ERC165 interface ID: 0x01ffc9a7
      const ERC165_INTERFACE_ID = "0x01ffc9a7";
      expect(await token.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });
  });
});

/**
 * Integration Tests (Require FHE Setup)
 * 
 * These tests require:
 * 1. fhevmjs SDK installed
 * 2. FHE coprocessor running
 * 3. Proper FHE configuration
 * 
 * Example:
 * 
 * describe("ConfidentialSynthToken (FHE Integration)", function () {
 *   let fhevm: any;
 * 
 *   before(async function () {
 *     fhevm = await createInstance({ chainId: 31337 });
 *   });
 * 
 *   it("should mint encrypted tokens", async function () {
 *     await token.connect(owner).setVault(vault.address);
 * 
 *     // Create encrypted input
 *     const amount = 1000n * 10n ** 18n;
 *     const encryptedInput = await fhevm
 *       .createEncryptedInput(await token.getAddress(), vault.address)
 *       .add64(amount)
 *       .encrypt();
 * 
 *     // Mint from vault
 *     await token.connect(vault).mint(user.address, encryptedInput.handles[0]);
 * 
 *     // Check encrypted balance exists
 *     const encBalance = await token.confidentialBalanceOf(user.address);
 *     expect(encBalance).to.not.equal(0n);
 * 
 *     // Decrypt balance
 *     const balance = await fhevm.decrypt(encBalance, user.address);
 *     expect(balance).to.equal(amount);
 *   });
 * });
 */

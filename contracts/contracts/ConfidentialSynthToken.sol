// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title ConfidentialSynthToken
/// @notice ERC7984 confidential token representing a synthetic equity position.
///         Balances and transfers are FULLY ENCRYPTED using Zama's FHE.
///         This provides MEV protection and trade privacy for synthetic positions.
///
/// @dev    Deployed once per synthetic asset (sAAPL, sTSLA, sNVDA, sSPY).
///         Only the vault can mint/burn tokens.
///         Inherits from ERC7984 for confidential token standard compliance.
///
///         KEY FEATURES:
///         - Encrypted balances (no one can see your position size)
///         - Encrypted transfers (MEV bots can't front-run based on trade size)
///         - ERC7984 standard compliance (interoperable with other confidential DeFi)
///         - Vault-only minting (only ConfidentialSynthVaultFHE can create/destroy tokens)
contract ConfidentialSynthToken is ZamaEthereumConfig, ERC7984, Ownable2Step {
    
    // ─── State ───────────────────────────────────────────────────────────────
    address public vault;
    string public underlyingAsset; // e.g. "AAPL"

    // ─── Events ──────────────────────────────────────────────────────────────
    event VaultSet(address indexed vault);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error OnlyVault();
    error VaultAlreadySet();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param owner_ Contract owner (typically deployer or governance)
    /// @param name_ Full name, e.g. "Confidential Synthetic Apple"
    /// @param symbol_ Token symbol, e.g. "csAAPL"
    /// @param underlying_ Underlying asset ticker, e.g. "AAPL"
    /// @param tokenURI_ Metadata URI for the token
    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        string memory underlying_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) Ownable(owner_) ZamaEthereumConfig() {
        underlyingAsset = underlying_;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Set the vault address once (owner only, irreversible).
    /// @param vaultAddress Address of the deployed ConfidentialSynthVaultFHE.
    function setVault(address vaultAddress) external onlyOwner {
        if (vault != address(0)) revert VaultAlreadySet();
        if (vaultAddress == address(0)) revert ZeroAddress();
        vault = vaultAddress;
        emit VaultSet(vaultAddress);
    }

    // ─── Minting & Burning ───────────────────────────────────────────────────

    /// @notice Mint confidential synth tokens to a recipient (vault only).
    /// @dev    Amount is encrypted - no one can see how many tokens are minted.
    /// @param to Recipient address
    /// @param encryptedAmount Encrypted amount to mint (euint64)
    /// @return transferred The encrypted amount that was minted
    function mint(address to, euint64 encryptedAmount) external onlyVault returns (euint64 transferred) {
        return _mint(to, encryptedAmount);
    }

    /// @notice Burn confidential synth tokens from an account (vault only).
    /// @dev    Amount is encrypted - no one can see how many tokens are burned.
    /// @param from Account to burn from
    /// @param encryptedAmount Encrypted amount to burn (euint64)
    /// @return transferred The encrypted amount that was burned
    function burn(address from, euint64 encryptedAmount) external onlyVault returns (euint64 transferred) {
        return _burn(from, encryptedAmount);
    }

    /// @notice Mint confidential tokens with encrypted input (vault only).
    /// @dev    This version accepts external encrypted input with proof.
    /// @param to Recipient address
    /// @param encryptedAmount External encrypted amount (externalEuint64)
    /// @param inputProof Proof for the encrypted input
    /// @return transferred The encrypted amount that was minted
    function confidentialMint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyVault returns (euint64 transferred) {
        return _mint(to, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /// @notice Burn confidential tokens with encrypted input (vault only).
    /// @dev    This version accepts external encrypted input with proof.
    /// @param from Account to burn from
    /// @param encryptedAmount External encrypted amount (externalEuint64)
    /// @param inputProof Proof for the encrypted input
    /// @return transferred The encrypted amount that was burned
    function confidentialBurn(
        address from,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyVault returns (euint64 transferred) {
        return _burn(from, FHE.fromExternal(encryptedAmount, inputProof));
    }

    // ─── Owner Visibility ────────────────────────────────────────────────────

    /// @notice Override _update to grant owner visibility of total supply.
    /// @dev    This allows the owner to decrypt total supply for administrative purposes.
    ///         Useful for monitoring token economics and supply management.
    function _update(
        address from,
        address to,
        euint64 amount
    ) internal virtual override returns (euint64 transferred) {
        transferred = super._update(from, to, amount);
        // Grant owner permission to decrypt total supply
        FHE.allow(confidentialTotalSupply(), owner());
    }
}

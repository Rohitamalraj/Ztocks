// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SynthToken
/// @notice ERC-20 token representing a synthetic equity position.
///         Mint/burn is restricted to the SynthVault only.
///         Deployed once per synthetic asset (sAAPL, sTSLA, sNVDA, sSPY).
contract SynthToken is ERC20, Ownable {
    address public vault;
    string public underlyingAsset; // e.g. "AAPL"

    event VaultSet(address indexed vault);

    error OnlyVault();
    error VaultAlreadySet();
    error ZeroAddress();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    /// @param name_ Full name, e.g. "Synthetic Apple"
    /// @param symbol_ Token symbol, e.g. "sAAPL"
    /// @param underlying_ Underlying asset ticker, e.g. "AAPL"
    constructor(
        string memory name_,
        string memory symbol_,
        string memory underlying_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        underlyingAsset = underlying_;
    }

    /// @notice Set the vault address once (owner only, irreversible).
    /// @param vaultAddress Address of the deployed SynthVault.
    function setVault(address vaultAddress) external onlyOwner {
        if (vault != address(0)) revert VaultAlreadySet();
        if (vaultAddress == address(0)) revert ZeroAddress();
        vault = vaultAddress;
        emit VaultSet(vaultAddress);
    }

    /// @notice Mint synth tokens to a recipient (vault only).
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /// @notice Burn synth tokens from an account (vault only).
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}

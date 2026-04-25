// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock USDC for testnet — 6 decimals, free mint for anyone.
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 1e6); // 10M USDC to deployer
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint testnet USDC (for demo/testing).
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

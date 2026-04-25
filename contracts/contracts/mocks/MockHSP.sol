// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock HSP token for testnet — 18 decimals, free mint for demo.
contract MockHSP is ERC20, Ownable {
    constructor() ERC20("HashKey Token", "HSP") Ownable(msg.sender) {
        _mint(msg.sender, 100_000_000 * 1e18); // 100M HSP to deployer
    }

    /// @notice Anyone can mint testnet HSP (for demo/testing).
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

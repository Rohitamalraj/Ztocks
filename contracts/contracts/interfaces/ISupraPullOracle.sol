// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISupraPullOracle
/// @notice Interface for SUPRA Pull Oracle on HashKey Chain.
/// @dev Deployed at 0x16f70cAD28dd621b0072B5A8a8c392970E87C3dD on HashKey testnet.
interface ISupraPullOracle {
    struct PriceData {
        uint256 round;
        uint256 decimals;
        uint256 time;
        uint256 price;
    }

    /// @notice Get price by SUPRA pair index.
    /// @param pairId SUPRA feed pair ID (e.g. AAPL/USD = specific ID from SUPRA docs).
    /// @return price Price with 8 decimal places.
    /// @return timestamp Unix timestamp of the last price update.
    function getPrice(uint256 pairId) external view returns (uint256 price, uint256 timestamp);

    /// @notice Get multiple prices in a single call.
    function getPriceForMultiplePair(uint256[] calldata pairIds)
        external
        view
        returns (PriceData[] memory);
}

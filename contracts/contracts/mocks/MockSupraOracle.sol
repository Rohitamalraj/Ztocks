// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ISupraPullOracle.sol";

/// @notice Mock SUPRA oracle for local testing. Allows arbitrary price injection.
contract MockSupraOracle is ISupraPullOracle {
    struct Feed {
        uint256 price;
        uint256 timestamp;
    }

    mapping(uint256 => Feed) private _feeds;

    /// @notice Set a price feed for a pair ID (test helper).
    function setPrice(uint256 pairId, uint256 price, uint256 timestamp) external {
        _feeds[pairId] = Feed({ price: price, timestamp: timestamp });
    }

    /// @notice Set price with current block timestamp.
    function setPriceFresh(uint256 pairId, uint256 price) external {
        _feeds[pairId] = Feed({ price: price, timestamp: block.timestamp });
    }

    function getPrice(uint256 pairId)
        external
        view
        override
        returns (uint256 price, uint256 timestamp)
    {
        Feed memory f = _feeds[pairId];
        return (f.price, f.timestamp);
    }

    function getPriceForMultiplePair(uint256[] calldata pairIds)
        external
        view
        override
        returns (PriceData[] memory result)
    {
        result = new PriceData[](pairIds.length);
        for (uint256 i = 0; i < pairIds.length; i++) {
            Feed memory f = _feeds[pairIds[i]];
            result[i] = PriceData({
                round:    1,
                decimals: 8,
                time:     f.timestamp,
                price:    f.price
            });
        }
        return result;
    }
}

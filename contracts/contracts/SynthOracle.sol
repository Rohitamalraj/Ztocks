// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ISupraPullOracle.sol";

/// @title SynthOracle
/// @notice Wraps the SUPRA Pull Oracle to provide price feeds for synthetic assets.
///         Enforces a 30-minute staleness guard on all price reads.
contract SynthOracle is Ownable {
    ISupraPullOracle public immutable supraOracle;

    uint256 public constant STALENESS_THRESHOLD = 1800; // 30 minutes
    uint256 public constant PRICE_DECIMALS = 8;

    /// @dev Maps synth token address → SUPRA pair ID.
    mapping(address => uint256) public pairId;

    /// @dev Track which assets are registered.
    mapping(address => bool) public isRegistered;

    event AssetRegistered(address indexed synthToken, uint256 pairId);
    event AssetDeregistered(address indexed synthToken);

    error AssetNotRegistered(address synthToken);
    error PriceStale(address synthToken, uint256 age);
    error ZeroPrice(address synthToken);

    /// @param supraOracleAddress SUPRA Pull Oracle address on HashKey Chain.
    constructor(address supraOracleAddress) Ownable(msg.sender) {
        require(supraOracleAddress != address(0), "SynthOracle: zero address");
        supraOracle = ISupraPullOracle(supraOracleAddress);
    }

    /// @notice Register a synth token with its SUPRA pair ID (owner only).
    /// @param synthToken Address of the SynthToken contract.
    /// @param supraFeedId SUPRA pair ID for this asset's USD price feed.
    function registerAsset(address synthToken, uint256 supraFeedId) external onlyOwner {
        require(synthToken != address(0), "SynthOracle: zero address");
        pairId[synthToken] = supraFeedId;
        isRegistered[synthToken] = true;
        emit AssetRegistered(synthToken, supraFeedId);
    }

    /// @notice Deregister an asset (owner only).
    function deregisterAsset(address synthToken) external onlyOwner {
        isRegistered[synthToken] = false;
        emit AssetDeregistered(synthToken);
    }

    /// @notice Get price with staleness check. Reverts if stale.
    /// @param synthToken Address of the synth token.
    /// @return price Price in 8-decimal USD.
    function getPrice(address synthToken) external view returns (uint256 price) {
        if (!isRegistered[synthToken]) revert AssetNotRegistered(synthToken);
        (uint256 rawPrice, uint256 timestamp) = supraOracle.getPrice(pairId[synthToken]);
        uint256 age = block.timestamp - timestamp;
        if (age > STALENESS_THRESHOLD) revert PriceStale(synthToken, age);
        if (rawPrice == 0) revert ZeroPrice(synthToken);
        return rawPrice;
    }

    /// @notice Get price WITHOUT staleness check (for liquidation calculations).
    /// @dev Use only when you explicitly want the last known price regardless of age.
    function getPriceUnsafe(address synthToken) external view returns (uint256 price) {
        if (!isRegistered[synthToken]) revert AssetNotRegistered(synthToken);
        (uint256 rawPrice, ) = supraOracle.getPrice(pairId[synthToken]);
        if (rawPrice == 0) revert ZeroPrice(synthToken);
        return rawPrice;
    }

    /// @notice Get both price and timestamp (staleness-checked).
    function getPriceWithTimestamp(address synthToken)
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        if (!isRegistered[synthToken]) revert AssetNotRegistered(synthToken);
        (uint256 rawPrice, uint256 ts) = supraOracle.getPrice(pairId[synthToken]);
        uint256 age = block.timestamp - ts;
        if (age > STALENESS_THRESHOLD) revert PriceStale(synthToken, age);
        if (rawPrice == 0) revert ZeroPrice(synthToken);
        return (rawPrice, ts);
    }
}

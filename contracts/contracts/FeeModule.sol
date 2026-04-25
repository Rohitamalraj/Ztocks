// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeModule
/// @notice Collects protocol fees in a fee token on open/close of positions.
contract FeeModule is Ownable {
    using SafeERC20 for IERC20;

    IERC20  public immutable feeToken;
    address public treasury;
    address public vault;

    uint256 public feeRateOpenBps  = 10; // 0.10%
    uint256 public feeRateCloseBps = 10; // 0.10%

    uint256 public constant MAX_FEE_BPS = 100; // 1% hard cap
    uint256 public constant BPS_DENOM   = 10000;

    /// @dev Fee token per USDC exchange rate (18 decimals)
    uint256 public feeTokenPerUsdc = 5e15; // 0.005 fee token per USDC

    event FeeCollected(address indexed user, string action, uint256 feeAmount);
    event FeeRateUpdated(uint256 openBps, uint256 closeBps);
    event TreasuryUpdated(address indexed newTreasury);
    event VaultSet(address indexed vault);
    event FeeRatePerUsdcUpdated(uint256 newRate);

    error OnlyVault();
    error ZeroAddress();
    error FeeTooHigh();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address feeTokenAddress, address treasuryAddress) Ownable(msg.sender) {
        if (feeTokenAddress == address(0) || treasuryAddress == address(0)) revert ZeroAddress();
        feeToken = IERC20(feeTokenAddress);
        treasury = treasuryAddress;
    }

    function setVault(address vaultAddress) external onlyOwner {
        if (vaultAddress == address(0)) revert ZeroAddress();
        vault = vaultAddress;
        emit VaultSet(vaultAddress);
    }

    function collectOpenFee(address user, uint256 collateralUSDC) external onlyVault {
        uint256 fee = getFeeQuote(collateralUSDC, feeRateOpenBps);
        if (fee == 0) return;
        feeToken.safeTransferFrom(user, treasury, fee);
        emit FeeCollected(user, "open", fee);
    }

    function collectCloseFee(address user, uint256 returnUSDC) external onlyVault {
        uint256 fee = getFeeQuote(returnUSDC, feeRateCloseBps);
        if (fee == 0) return;
        feeToken.safeTransferFrom(user, treasury, fee);
        emit FeeCollected(user, "close", fee);
    }

    function getFeeQuote(uint256 usdcAmount, uint256 rateBps) public view returns (uint256) {
        uint256 usdcFee = (usdcAmount * rateBps) / BPS_DENOM;
        return (usdcFee * feeTokenPerUsdc) / 1e6;
    }

    function getOpenFeeQuote(uint256 collateralUSDC) external view returns (uint256) {
        return getFeeQuote(collateralUSDC, feeRateOpenBps);
    }

    function getCloseFeeQuote(uint256 returnUSDC) external view returns (uint256) {
        return getFeeQuote(returnUSDC, feeRateCloseBps);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setFeeRates(uint256 openBps, uint256 closeBps) external onlyOwner {
        if (openBps > MAX_FEE_BPS || closeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeRateOpenBps  = openBps;
        feeRateCloseBps = closeBps;
        emit FeeRateUpdated(openBps, closeBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setFeeTokenRate(uint256 newRate) external onlyOwner {
        feeTokenPerUsdc = newRate;
        emit FeeRatePerUsdcUpdated(newRate);
    }

    function withdrawFees(address token, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }
}

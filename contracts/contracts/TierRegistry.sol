// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IKycSBT.sol";

/// @title TierRegistry
/// @notice Maps HashKey KYC SBT levels to leverage caps.
///         This is the core novel layer of zkSynth Access:
///         on-chain identity directly governs financial parameters.
contract TierRegistry is Ownable {
    IKycSBT public immutable kycSBT;

    /// @notice Maps KycLevel enum value → maximum leverage (1–10).
    mapping(uint8 => uint8) public leverageCap;

    event TierCapUpdated(IKycSBT.KycLevel indexed level, uint8 newCap);

    error NotEligible(address user);
    error InvalidLeverageCap(uint8 cap);

    /// @param kycSBTAddress HashKey KYC SBT contract address.
    constructor(address kycSBTAddress) Ownable(msg.sender) {
        require(kycSBTAddress != address(0), "TierRegistry: zero address");
        kycSBT = IKycSBT(kycSBTAddress);

        // Initial tier → leverage cap mapping
        leverageCap[uint8(IKycSBT.KycLevel.NONE)]     = 0;
        leverageCap[uint8(IKycSBT.KycLevel.BASIC)]    = 2;
        leverageCap[uint8(IKycSBT.KycLevel.ADVANCED)] = 5;
        leverageCap[uint8(IKycSBT.KycLevel.PREMIUM)]  = 8;
        leverageCap[uint8(IKycSBT.KycLevel.ULTIMATE)] = 10;
    }

    /// @notice Get the maximum leverage cap for a given wallet.
    /// @dev Reads live KYC level from on-chain SBT — no caching.
    /// @param wallet Address to check.
    /// @return cap Maximum allowed leverage multiplier. 0 if not eligible.
    function getLeverageCap(address wallet) external view returns (uint8 cap) {
        (, uint8 level) = kycSBT.isHuman(wallet);
        return leverageCap[level];
    }

    /// @notice Check if a wallet is eligible to trade (approved + level >= BASIC).
    /// @param wallet Address to check.
    /// @return True if the wallet holds a valid, approved KYC SBT at level >= BASIC.
    function isEligible(address wallet) external view returns (bool) {
        (, , IKycSBT.KycStatus status, ) = kycSBT.getKycInfo(wallet);
        (bool human, uint8 level) = kycSBT.isHuman(wallet);
        return human
            && status == IKycSBT.KycStatus.APPROVED
            && level >= uint8(IKycSBT.KycLevel.BASIC);
    }

    /// @notice Get the KYC level for a wallet as an enum.
    function getLevel(address wallet) external view returns (IKycSBT.KycLevel) {
        (, uint8 level) = kycSBT.isHuman(wallet);
        return IKycSBT.KycLevel(level);
    }

    /// @notice Update a tier's leverage cap (owner only).
    /// @param level The KycLevel to update.
    /// @param newCap New maximum leverage (1–10 for eligible tiers, 0 for NONE).
    function setLeverageCap(IKycSBT.KycLevel level, uint8 newCap) external onlyOwner {
        if (level != IKycSBT.KycLevel.NONE && (newCap == 0 || newCap > 20)) {
            revert InvalidLeverageCap(newCap);
        }
        leverageCap[uint8(level)] = newCap;
        emit TierCapUpdated(level, newCap);
    }
}

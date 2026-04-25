// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IKycSBT
/// @notice Interface for HashKey Chain's native KYC Soul-Bound Token contract.
/// @dev Deployed at 0xBd9f96663E07a83ff18915c9074d9dc04d8E64c9 on HashKey testnet.
interface IKycSBT {
    enum KycLevel {
        NONE,       // 0 — not verified
        BASIC,      // 1 — basic KYC (2x leverage cap)
        ADVANCED,   // 2 — accredited investor (5x leverage cap)
        PREMIUM,    // 3 — premium HNW (8x leverage cap)
        ULTIMATE    // 4 — institutional QIB (10x leverage cap)
    }

    enum KycStatus {
        NONE,       // 0 — never applied
        APPROVED,   // 1 — active and approved
        REVOKED     // 2 — revoked / expired
    }

    /// @notice Initiate a KYC request for the caller.
    function requestKyc(string calldata ensName) external payable;

    /// @notice Revoke KYC for a user (admin only).
    function revokeKyc(address user) external;

    /// @notice Restore a previously revoked KYC (admin only).
    function restoreKyc(address user) external;

    /// @notice Check if an account is a verified human.
    /// @return isHuman True if approved and level >= BASIC.
    /// @return level The raw KycLevel uint8.
    function isHuman(address account) external view returns (bool isHuman, uint8 level);

    /// @notice Get full KYC information for an account.
    function getKycInfo(address account)
        external
        view
        returns (
            string memory ensName,
            KycLevel level,
            KycStatus status,
            uint256 createTime
        );

    /// @notice Check if a user's ENS name matches the approved one.
    function isEnsNameApproved(address user, string calldata ensName) external view returns (bool);
}

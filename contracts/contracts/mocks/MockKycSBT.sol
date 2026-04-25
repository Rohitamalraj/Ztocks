// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IKycSBT.sol";

/// @notice Mock KYC SBT for local testing. Allows arbitrary tier assignment.
contract MockKycSBT is IKycSBT {
    struct KycRecord {
        KycLevel  level;
        KycStatus status;
        string    ensName;
        uint256   createTime;
    }

    mapping(address => KycRecord) private _records;

    /// @notice Set KYC data for a test address (test helper).
    function setKyc(
        address user,
        KycLevel level,
        KycStatus status
    ) external {
        _records[user] = KycRecord({
            level:      level,
            status:     status,
            ensName:    "test.hsk",
            createTime: block.timestamp
        });
    }

    function requestKyc(string calldata) external payable override {}

    function revokeKyc(address user) external override {
        _records[user].status = KycStatus.REVOKED;
    }

    function restoreKyc(address user) external override {
        _records[user].status = KycStatus.APPROVED;
    }

    function isHuman(address account) external view override returns (bool, uint8) {
        KycRecord memory r = _records[account];
        bool human = r.status == KycStatus.APPROVED && r.level >= KycLevel.BASIC;
        return (human, uint8(r.level));
    }

    function getKycInfo(address account)
        external
        view
        override
        returns (string memory, KycLevel, KycStatus, uint256)
    {
        KycRecord memory r = _records[account];
        return (r.ensName, r.level, r.status, r.createTime);
    }

    function isEnsNameApproved(address user, string calldata ensName)
        external
        view
        override
        returns (bool)
    {
        return keccak256(bytes(_records[user].ensName)) == keccak256(bytes(ensName));
    }
}

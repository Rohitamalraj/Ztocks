// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockZKVerifier
/// @notice Test double for ZKVerifier. Lets tests set tier directly without proofs.
contract MockZKVerifier {

    struct ClaimInfo {
        string provider;
        string parameters;
        string context;
    }
    struct CompleteClaimData {
        bytes32 identifier;
        address owner;
        uint32  timestampS;
        uint32  epoch;
    }
    struct SignedClaim {
        CompleteClaimData claim;
        bytes[]           signatures;
    }
    struct Proof {
        ClaimInfo   claimInfo;
        SignedClaim signedClaim;
    }

    mapping(address => uint8)   public userTier;
    mapping(address => uint256) public userProofExpiry;

    // ─── Test helpers ─────────────────────────────────────────────────────────

    /// @dev Call from tests to give an address a specific tier.
    function mockSetTier(address user, uint8 tier) external {
        userTier[user]        = tier;
        userProofExpiry[user] = block.timestamp + 30 days;
    }

    /// @dev Revoke a user's verification (simulate expiry / invalid proof).
    function mockRevoke(address user) external {
        userTier[user]        = 0;
        userProofExpiry[user] = 0;
    }

    // ─── ZKVerifier interface ─────────────────────────────────────────────────

    function isVerified(address user) external view returns (bool) {
        return userTier[user] > 0 && block.timestamp <= userProofExpiry[user];
    }

    function getTier(address user) external view returns (uint8 tier, uint256 expiry) {
        return (userTier[user], userProofExpiry[user]);
    }

    /// @dev Auto-approves sender as tier 2 (suitable for most tests).
    function submitProof(Proof memory) external {
        userTier[msg.sender]        = 2;
        userProofExpiry[msg.sender] = block.timestamp + 30 days;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialTierManager
/// @notice Stores FHE-encrypted KYC tiers per wallet and maps tiers to leverage caps.
///         The tier value is set by the ZKVerifier (after ZK proof) and stored as encrypted euint8.
///         Leverage caps are enforced by checking encrypted leverage against encrypted tier caps.
///
/// @dev Architecture: ZK proof → ZKVerifier stores tier → TierManager encrypts tier → Vault checks leverage
///      This gives us ZK-verified identity + FHE-encrypted tier + FHE-encrypted positions.
contract ConfidentialTierManager is Ownable, ZamaEthereumConfig {

    // ─── State ────────────────────────────────────────────────────────────────
    /// @notice Encrypted tier per user (euint8: 1-4)
    mapping(address => euint8) private encryptedTier;
    
    /// @notice tier => max leverage cap (e.g., tier 2 => 5x) - plaintext policy
    mapping(uint8 => uint8) public maxLeverage;

    // ─── Events ───────────────────────────────────────────────────────────────
    event LeverageCapUpdated(uint8 indexed tier, uint8 newCap);
    event TierSet(address indexed user);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) ZamaEthereumConfig() {
        maxLeverage[1] = 2;   // Basic KYC
        maxLeverage[2] = 5;   // Accredited Investor
        maxLeverage[3] = 8;   // Premium / High Net Worth
        maxLeverage[4] = 10;  // Institutional / QIB
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /// @notice Set encrypted tier for a user (called by ZKVerifier after proof verification)
    /// @param user The user address
    /// @param tier The plaintext tier value (1-4) to encrypt and store
    function setTier(address user, uint8 tier) external onlyOwner {
        require(tier >= 1 && tier <= 4, "ConfidentialTierManager: invalid tier");
        
        // Convert plaintext tier to encrypted euint8
        encryptedTier[user] = FHE.asEuint8(tier);
        
        // Allow the user to decrypt their own tier
        FHE.allow(encryptedTier[user], user);
        
        emit TierSet(user);
    }

    /// @notice Check if requested leverage is valid for user's encrypted tier
    /// @param user The user address
    /// @param requestedLeverage Encrypted leverage value to check
    /// @return isValid Encrypted boolean indicating if leverage is within tier cap
    function checkLeverage(address user, euint8 requestedLeverage) external returns (ebool) {
        euint8 userTier = encryptedTier[user];
        
        // Start with false
        ebool isValid = FHE.asEbool(false);
        
        // Check each tier: if user's tier matches AND leverage is within cap, set valid
        for (uint8 t = 1; t <= 4; t++) {
            euint8 tierValue = FHE.asEuint8(t);
            ebool isTier = FHE.eq(userTier, tierValue);
            euint8 cap = FHE.asEuint8(maxLeverage[t]);
            ebool leverageOk = FHE.le(requestedLeverage, cap);
            ebool tierValid = FHE.and(isTier, leverageOk);
            isValid = FHE.or(isValid, tierValid);
        }
        
        return isValid;
    }

    /// @notice Get encrypted tier for a user (only user can decrypt)
    /// @param user The user address
    /// @return Encrypted tier value
    function getEncryptedTier(address user) external view returns (euint8) {
        return encryptedTier[user];
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Returns the maximum leverage for a given tier (plaintext policy).
    /// @param  tier  KYC tier (1–4). Returns 0 for unrecognised tiers.
    function getMaxLeverage(uint8 tier) external view returns (uint8) {
        return maxLeverage[tier];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Owner can adjust leverage caps (e.g., for regulatory changes).
    function setMaxLeverage(uint8 tier, uint8 cap) external onlyOwner {
        require(tier >= 1 && tier <= 4, "ConfidentialTierManager: invalid tier");
        require(cap >= 1 && cap <= 20,  "ConfidentialTierManager: cap out of range");
        maxLeverage[tier] = cap;
        emit LeverageCapUpdated(tier, cap);
    }
}

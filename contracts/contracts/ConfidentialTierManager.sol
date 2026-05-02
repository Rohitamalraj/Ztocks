// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialTierManager
/// @notice Stores FHE-encrypted KYC tiers per wallet.
///         The tier is set by the ZKVerifier after proof verification, stored as encrypted euint8.
///         On Zama's fhEVM (Sepolia), FHE operations execute on-chain.
contract ConfidentialTierManager is Ownable, ZamaEthereumConfig {

    // ─── State ────────────────────────────────────────────────────────────────
    /// @notice Address of the ZKVerifier allowed to set tiers
    address public zkVerifier;

    /// @notice Encrypted tier per user (euint8: 1-4)
    mapping(address => euint8) private encryptedTier;

    /// @notice tier => max leverage cap (plaintext policy)
    mapping(uint8 => uint8) public maxLeverage;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ZKVerifierSet(address indexed verifier);
    event LeverageCapUpdated(uint8 indexed tier, uint8 newCap);
    event TierSet(address indexed user);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error OnlyZKVerifier();
    error ZKVerifierAlreadySet();
    error ZeroAddress();

    // ─── Modifier ─────────────────────────────────────────────────────────────
    modifier onlyZKVerifier() {
        if (msg.sender != zkVerifier) revert OnlyZKVerifier();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) ZamaEthereumConfig() {
        maxLeverage[1] = 2;   // Basic KYC
        maxLeverage[2] = 5;   // Accredited Investor
        maxLeverage[3] = 8;   // Premium / High Net Worth
        maxLeverage[4] = 10;  // Institutional / QIB
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Set the ZKVerifier address (owner only, one-time).
    function setZKVerifier(address _zkVerifier) external onlyOwner {
        if (zkVerifier != address(0)) revert ZKVerifierAlreadySet();
        if (_zkVerifier == address(0)) revert ZeroAddress();
        zkVerifier = _zkVerifier;
        emit ZKVerifierSet(_zkVerifier);
    }

    /// @notice Owner can adjust leverage caps.
    function setMaxLeverage(uint8 tier, uint8 cap) external onlyOwner {
        require(tier >= 1 && tier <= 4, "invalid tier");
        require(cap >= 1 && cap <= 20,  "cap out of range");
        maxLeverage[tier] = cap;
        emit LeverageCapUpdated(tier, cap);
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /// @notice Set encrypted tier for a user — called by ZKVerifier after proof.
    /// @param user  The user address
    /// @param tier  Plaintext tier (1-4) to encrypt and store
    function setTier(address user, uint8 tier) external onlyZKVerifier {
        require(tier >= 1 && tier <= 4, "invalid tier");

        // Encrypt the tier value using Zama's fhEVM
        encryptedTier[user] = FHE.asEuint8(tier);

        // Allow the user to decrypt their own tier
        FHE.allow(encryptedTier[user], user);

        // Allow this contract to use the tier for leverage checks
        FHE.allowThis(encryptedTier[user]);

        emit TierSet(user);
    }

    /// @notice Check if requested leverage is valid for user's encrypted tier.
    /// @dev    Runs entirely on encrypted data — contract never sees plaintext.
    function checkLeverage(address user, euint8 requestedLeverage) external returns (ebool) {
        euint8 userTier = encryptedTier[user];

        ebool isValid = FHE.asEbool(false);
        for (uint8 t = 1; t <= 4; t++) {
            euint8 tierValue  = FHE.asEuint8(t);
            ebool  isTier     = FHE.eq(userTier, tierValue);
            euint8 cap        = FHE.asEuint8(maxLeverage[t]);
            ebool  leverageOk = FHE.le(requestedLeverage, cap);
            ebool  tierValid  = FHE.and(isTier, leverageOk);
            isValid           = FHE.or(isValid, tierValid);
        }

        return isValid;
    }

    /// @notice Get encrypted tier handle for a user (only user can decrypt).
    function getEncryptedTier(address user) external view returns (euint8) {
        return encryptedTier[user];
    }

    /// @notice Get max leverage for a given tier (plaintext policy).
    function getMaxLeverage(uint8 tier) external view returns (uint8) {
        return maxLeverage[tier];
    }
}

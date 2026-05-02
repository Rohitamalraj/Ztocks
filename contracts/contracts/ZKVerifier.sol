// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Groth16Verifier.sol";
import "./ConfidentialTierManager.sol";

/// @title ZKVerifier
/// @notice Verifies Groth16 ZK proofs to register a wallet's KYC tier on-chain.
///         After proof verification, calls ConfidentialTierManager.setTier()
///         to store the tier as an FHE-encrypted value (on Zama's fhEVM).
///
/// @dev Circuit: circuits/tier_proof.circom
///      Public signals layout (pubSignals[6]):
///        [0] nullifier      — Poseidon(nonce, walletAddr), anti-replay
///        [1] tierPub        — KYC tier 1-4 committed by proof
///        [2] expiryPub      — credential expiry (unix timestamp)
///        [3] walletAddrPub  — wallet address as uint160
///        [4] Ax             — oracle Baby Jubjub public key X
///        [5] Ay             — oracle Baby Jubjub public key Y
contract ZKVerifier is Ownable {

    // ─── State ────────────────────────────────────────────────────────────────
    Groth16Verifier           public immutable verifier;
    ConfidentialTierManager   public immutable tierManager;

    /// @notice Oracle's Baby Jubjub public key — must match /api/kyc/issue signing key
    uint256 public immutable ORACLE_AX;
    uint256 public immutable ORACLE_AY;

    /// @notice Verified KYC tier per user wallet (1–4). 0 = not verified.
    mapping(address => uint8)   public userTier;

    /// @notice Timestamp when the user's credential expires.
    mapping(address => uint256) public userProofExpiry;

    /// @notice Nullifiers already used — prevents proof replay.
    mapping(uint256 => bool)    public usedNullifiers;

    /// @notice Max leverage caps (mirrors TierManager, for direct reads).
    mapping(uint8 => uint8) public maxLeverage;

    // ─── Events ───────────────────────────────────────────────────────────────
    event TierVerified(address indexed user, uint8 tier, uint256 expiry);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NullifierAlreadyUsed(uint256 nullifier);
    error WrongOracleKey(uint256 gotAx, uint256 gotAy);
    error ProofNotForSender(uint256 proofAddr, address sender);
    error CredentialExpired(uint256 expiry);
    error InvalidTier(uint256 tier);
    error InvalidProof();

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _verifier,
        address _tierManager,
        uint256 _oracleAx,
        uint256 _oracleAy
    ) Ownable(msg.sender) {
        require(_verifier    != address(0), "ZKVerifier: zero verifier");
        require(_tierManager != address(0), "ZKVerifier: zero tierManager");
        verifier     = Groth16Verifier(_verifier);
        tierManager  = ConfidentialTierManager(_tierManager);
        ORACLE_AX    = _oracleAx;
        ORACLE_AY    = _oracleAy;

        // Default leverage caps (same as TierManager)
        maxLeverage[1] = 2;
        maxLeverage[2] = 5;
        maxLeverage[3] = 8;
        maxLeverage[4] = 10;
    }

    // ─── Core: Submit Proof ───────────────────────────────────────────────────

    /// @notice Submit a Groth16 proof to register your KYC tier on-chain.
    ///         On success, stores tier in plaintext mapping AND encrypts it
    ///         in ConfidentialTierManager via FHE (on Zama's fhEVM).
    function submitProof(
        uint[2]    calldata a,
        uint[2][2] calldata b,
        uint[2]    calldata c,
        uint[6]    calldata pubSignals
    ) external {
        uint256 nullifier     = pubSignals[0];
        uint256 tierPub       = pubSignals[1];
        uint256 expiryPub     = pubSignals[2];
        uint256 walletAddrPub = pubSignals[3];
        uint256 ax            = pubSignals[4];
        uint256 ay            = pubSignals[5];

        // 1. Anti-replay
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed(nullifier);

        // 2. Oracle key check
        if (ax != ORACLE_AX || ay != ORACLE_AY) revert WrongOracleKey(ax, ay);

        // 3. Proof must be for calling wallet
        if (uint160(walletAddrPub) != uint160(msg.sender))
            revert ProofNotForSender(walletAddrPub, msg.sender);

        // 4. Credential expiry check
        if (block.timestamp > expiryPub) revert CredentialExpired(expiryPub);

        // 5. Valid tier range
        if (tierPub == 0 || tierPub > 4) revert InvalidTier(tierPub);

        // 6. Verify Groth16 proof on-chain
        if (!verifier.verifyProof(a, b, c, pubSignals)) revert InvalidProof();

        // 7. Mark nullifier used
        usedNullifiers[nullifier]   = true;

        // 8. Store plaintext tier (for quick reads, chain ID enforcement, etc.)
        userTier[msg.sender]        = uint8(tierPub);
        userProofExpiry[msg.sender] = expiryPub;

        // 9. Encrypt tier into ConfidentialTierManager (FHE — Zama Sepolia)
        //    This enables the vault to do encrypted leverage checks.
        tierManager.setTier(msg.sender, uint8(tierPub));

        emit TierVerified(msg.sender, uint8(tierPub), expiryPub);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Returns true if user has a valid, non-expired ZK proof.
    function isVerified(address user) external view returns (bool) {
        return userTier[user] > 0 && block.timestamp <= userProofExpiry[user];
    }

    /// @notice Returns user's stored tier and expiry timestamp.
    function getTier(address user) external view returns (uint8 tier, uint256 expiry) {
        return (userTier[user], userProofExpiry[user]);
    }

    /// @notice Returns max leverage for a tier.
    function getMaxLeverage(uint8 tier) external view returns (uint8) {
        return maxLeverage[tier];
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function setMaxLeverage(uint8 tier, uint8 cap) external onlyOwner {
        require(tier >= 1 && tier <= 4, "ZKVerifier: invalid tier");
        require(cap  >= 1 && cap  <= 20, "ZKVerifier: cap out of range");
        maxLeverage[tier] = cap;
    }
}

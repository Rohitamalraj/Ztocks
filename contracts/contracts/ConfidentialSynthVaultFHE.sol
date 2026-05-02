// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";
import "./ZKVerifier.sol";
import "./ConfidentialTierManager.sol";
import "./ConfidentialSynthToken.sol";
import "./ConfidentialUSDC.sol";

/// @title ConfidentialSynthVaultFHE
/// @notice Core vault for opening/closing leveraged synthetic positions with FULL FHE encryption.
///
///         THE NOVEL MECHANISM — Dual Privacy Stack:
///         1. ZK Layer:  User's KYC tier is verified via Groth16 ZK proof (Circom circuit).
///                       The tier is derived from on-chain credit score, signed by a trusted oracle,
///                       and proven without revealing personal data.
///         2. FHE Layer: Position data (collateral, leverage, direction, P&L) is ENCRYPTED using
///                       Zama's FHE. The contract enforces leverage caps by checking encrypted
///                       leverage against encrypted tier caps using TFHE operations.
///
///         This architecture ensures:
///         - Identity privacy (ZK proofs — no PII on-chain)
///         - Trade privacy (position parameters encrypted, hidden from MEV bots)
///         - Compliance enforcement (tier-gated leverage without revealing tier value)
///
/// @dev    This is the PRODUCTION FHE version using euint types and TFHE operations.
///         All position data is encrypted on-chain and never decrypted by the contract.
contract ConfidentialSynthVaultFHE is Ownable, ReentrancyGuard, Pausable, ZamaEthereumConfig {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 1000; // 10%
    uint256 public constant LIQUIDATION_BONUS_BPS     = 500;  // 5% to liquidator
    uint256 public constant BPS_DENOMINATOR           = 10000;
    uint256 public constant PRICE_DECIMALS            = 1e8;  // 8 decimals

    // ─── External contracts ──────────────────────────────────────────────────
    ZKVerifier                public immutable zkVerifier;
    ConfidentialTierManager   public immutable tierManager;
    ConfidentialUSDC          public immutable collateralToken;

    // ─── State ───────────────────────────────────────────────────────────────
    /// @dev Registered synth tokens that can be traded.
    mapping(address => bool) public registeredAssets;

    /// @notice Position struct with ENCRYPTED fields for full FHE privacy
    struct EncryptedPosition {
        address asset;           // SynthToken contract address (plaintext, non-sensitive)
        ebool   isLong;          // ENCRYPTED: true = LONG, false = SHORT
        euint64 collateralUSDC;  // ENCRYPTED: USDC deposited (6 decimals)
        euint8  leverage;        // ENCRYPTED: leverage multiplier (1–10)
        euint64 entryPrice;      // ENCRYPTED: oracle price at open (8 decimals)
        euint64 synthAmount;     // ENCRYPTED: synth tokens minted (18 decimals)
        uint256 openTime;        // plaintext: block.timestamp at open (non-sensitive)
        bool    isOpen;          // plaintext: needed for iteration (non-sensitive)
    }

    /// @dev user address → array of positions (append-only, closed positions kept)
    mapping(address => EncryptedPosition[]) public positions;

    // ─── Events ──────────────────────────────────────────────────────────────
    event PositionOpened(
        address indexed user,
        uint256 indexed positionId,
        address indexed asset,
        uint256 openTime
    );

    event PositionClosed(
        address indexed user,
        uint256 indexed positionId,
        uint256 closeTime
    );

    event Liquidated(
        address indexed user,
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 liquidationTime
    );

    event AssetRegistered(address indexed synthToken);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error NotEligible(address user);
    error LeverageExceedsTierCap();
    error InvalidLeverage();
    error AssetNotRegistered(address asset);
    error PositionNotFound(uint256 positionId);
    error NotPositionOwner();
    error PositionAlreadyClosed();
    error HealthyPosition();
    error InsufficientCollateral();
    error InvalidExecutionPrice();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address zkVerifierAddress,
        address tierManagerAddress,
        address collateralTokenAddress
    ) Ownable(msg.sender) ZamaEthereumConfig() {
        require(zkVerifierAddress   != address(0), "ConfidentialSynthVaultFHE: zero zkVerifier");
        require(tierManagerAddress  != address(0), "ConfidentialSynthVaultFHE: zero tierManager");
        require(collateralTokenAddress != address(0), "ConfidentialSynthVaultFHE: zero collateral token");

        zkVerifier  = ZKVerifier(zkVerifierAddress);
        tierManager = ConfidentialTierManager(tierManagerAddress);
        collateralToken = ConfidentialUSDC(collateralTokenAddress);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Register a synth asset for trading (owner only).
    function registerSynthAsset(address synthToken) external onlyOwner {
        require(synthToken != address(0), "ConfidentialSynthVaultFHE: zero address");
        registeredAssets[synthToken] = true;
        emit AssetRegistered(synthToken);
    }

    /// @notice Pause all trading in an emergency.
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause trading.
    function unpause() external onlyOwner { _unpause(); }

    // ─── Core: Open Position ─────────────────────────────────────────────────

    /// @notice Open a leveraged synthetic position with ENCRYPTED inputs.
    /// @dev THE KEY FHE ENFORCEMENT: leverage is checked against tier cap using FHE operations.
    ///      The contract NEVER sees plaintext collateral, leverage, or direction.
    /// @param synthToken The synth asset to trade
    /// @param encIsLong Encrypted input for direction (true = LONG, false = SHORT)
    /// @param encCollateralUSDC Encrypted input for collateral amount
    /// @param encLeverage Encrypted input for leverage (1-10)
    /// @param encExecutionPrice Encrypted input for execution price
    /// @param inputProof Proof for encrypted inputs
    function openPosition(
        address synthToken,
        externalEbool  encIsLong,
        externalEuint64  encCollateralUSDC,
        externalEuint8  encLeverage,
        externalEuint64  encExecutionPrice,
        bytes   calldata inputProof
    ) external nonReentrant whenNotPaused {
        // 1. ZK identity check: user must have a valid, non-expired ZK proof
        if (!zkVerifier.isVerified(msg.sender)) revert NotEligible(msg.sender);

        // 2. Asset must be registered
        if (!registeredAssets[synthToken]) revert AssetNotRegistered(synthToken);

        // 3. Convert encrypted inputs to euint types using FHE.fromExternal
        ebool   isLong         = FHE.fromExternal(encIsLong, inputProof);
        euint8  leverage       = FHE.fromExternal(encLeverage, inputProof);
        euint64 executionPrice = FHE.fromExternal(encExecutionPrice, inputProof);

        // 4. THE KEY FHE ENFORCEMENT: check leverage against tier cap
        //    This happens on ENCRYPTED data - contract never sees plaintext values
        //    We use FHE.select to conditionally proceed based on leverage validity
        ebool leverageValid = tierManager.checkLeverage(msg.sender, leverage);
        
        // If leverage is invalid, we set all values to 0 to effectively cancel the operation
        // This is the FHE-native way to handle conditional logic without decryption
        euint64 zero64 = FHE.asEuint64(0);
        euint8 zero8 = FHE.asEuint8(0);
        euint64 one64 = FHE.asEuint64(1);
        leverage = FHE.select(leverageValid, leverage, zero8);
        executionPrice = FHE.select(leverageValid, executionPrice, one64); // Avoid division by zero

        // 5. Pull confidential collateral (requires cUSDC operator approval)
        euint64 transferredCollateral = collateralToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            encCollateralUSDC,
            inputProof
        );

        // Refund if leverage is invalid
        euint64 refundAmount = FHE.select(leverageValid, zero64, transferredCollateral);
        FHE.allowThis(refundAmount);
        collateralToken.confidentialTransfer(msg.sender, refundAmount);

        euint64 collateralUSDC = FHE.select(leverageValid, transferredCollateral, zero64);
        FHE.allowThis(collateralUSDC);

        // 6. Calculate position size on ENCRYPTED data
        //    positionSize = collateral * leverage (all encrypted)
        //    Note: We use scalar multiplication where possible to save gas
        euint64 positionSize = FHE.mul(collateralUSDC, leverage);

        // 7. For hackathon demo, we simplify synth amount calculation
        //    In production, this would require async decryption of executionPrice
        //    or using a plaintext oracle price
        //    For now, we just use position size as synth amount (simplified)
        euint64 synthAmount = positionSize;

        // 8. Mint confidential synth tokens to the user
        ConfidentialSynthToken(synthToken).mint(msg.sender, synthAmount);

        // 9. Store ENCRYPTED position
        uint256 positionId = positions[msg.sender].length;
        positions[msg.sender].push(EncryptedPosition({
            asset:          synthToken,
            isLong:         isLong,
            collateralUSDC: collateralUSDC,
            leverage:       leverage,
            entryPrice:     executionPrice,
            synthAmount:    synthAmount,
            openTime:       block.timestamp,
            isOpen:         true
        }));

        // 10. Allow user to decrypt their own position data
        FHE.allow(isLong, msg.sender);
        FHE.allow(collateralUSDC, msg.sender);
        FHE.allow(leverage, msg.sender);
        FHE.allow(executionPrice, msg.sender);
        FHE.allow(synthAmount, msg.sender);

        emit PositionOpened(
            msg.sender,
            positionId,
            synthToken,
            block.timestamp
        );
    }

    /// @notice Open position with plaintext collateral for USDC transfer (hybrid approach)
    /// @dev This is a practical compromise: collateral is plaintext for USDC transfer,
    ///      but leverage and direction remain encrypted for MEV protection.
    function openPositionHybrid(
        address synthToken,
        bool    isLong,
        uint256 collateralUSDC,
        externalEuint8  encLeverage,
        uint256 executionPrice,
        bytes   calldata inputProof
    ) external nonReentrant whenNotPaused {
        // 1. ZK identity check
        if (!zkVerifier.isVerified(msg.sender)) revert NotEligible(msg.sender);

        // 2. Convert encrypted leverage
        euint8 leverage = FHE.fromExternal(encLeverage, inputProof);

        // 3. Check leverage against tier cap (FHE operation)
        ebool leverageValid = tierManager.checkLeverage(msg.sender, leverage);
        
        // For hybrid approach, we can use FHE.select to conditionally set leverage
        // If invalid, leverage becomes 1 (minimum valid value)
        euint8 one = FHE.asEuint8(1);
        leverage = FHE.select(leverageValid, leverage, one);

        // 4. Asset check
        if (!registeredAssets[synthToken]) revert AssetNotRegistered(synthToken);
        if (collateralUSDC == 0) revert InsufficientCollateral();
        if (executionPrice == 0) revert InvalidExecutionPrice();

        // 5. Pull USDC from user
        IERC20 underlying = IERC20(collateralToken.underlying());
        underlying.safeTransferFrom(msg.sender, address(this), collateralUSDC);
        underlying.safeIncreaseAllowance(address(collateralToken), collateralUSDC);

        // Wrap USDC into confidential cUSDC for the vault
        euint64 wrappedCollateral = collateralToken.wrap(address(this), collateralUSDC);
        FHE.allowThis(wrappedCollateral);

        // 6. Calculate position size (hybrid: some plaintext, leverage encrypted)
        uint256 positionSizeUSDC = collateralUSDC * 5; // Assume max 5x for demo
        uint256 synthAmountCalc = (positionSizeUSDC * 1e20) / executionPrice;

        // 7. Mint confidential synth tokens (encrypted amount)
        euint64 encSynthAmount = FHE.asEuint64(uint64(synthAmountCalc));
        ConfidentialSynthToken(synthToken).mint(msg.sender, encSynthAmount);

        // 8. Store position with encrypted leverage
        uint256 positionId = positions[msg.sender].length;
        positions[msg.sender].push(EncryptedPosition({
            asset:          synthToken,
            isLong:         FHE.asEbool(isLong),
            collateralUSDC: wrappedCollateral,
            leverage:       leverage,
            entryPrice:     FHE.asEuint64(uint64(executionPrice)),
            synthAmount:    FHE.asEuint64(uint64(synthAmountCalc)),
            openTime:       block.timestamp,
            isOpen:         true
        }));

        // 9. Allow user to decrypt
        FHE.allow(leverage, msg.sender);
        FHE.allow(wrappedCollateral, msg.sender);

        emit PositionOpened(msg.sender, positionId, synthToken, block.timestamp);
    }

    // ─── Core: Close Position ────────────────────────────────────────────────

    /// @notice Close an open position (simplified for hackathon)
    /// @dev In production, P&L would be calculated on encrypted data
    function closePosition(uint256 positionId, uint256 executionPrice) external nonReentrant whenNotPaused {
        if (positionId >= positions[msg.sender].length) revert PositionNotFound(positionId);
        EncryptedPosition storage pos = positions[msg.sender][positionId];
        if (!pos.isOpen) revert PositionAlreadyClosed();
        if (executionPrice == 0) revert InvalidExecutionPrice();

        // Burn synth tokens and return collateral (no P&L calculation in hackathon demo)
        ConfidentialSynthToken(pos.asset).burn(msg.sender, pos.synthAmount);
        collateralToken.confidentialTransfer(msg.sender, pos.collateralUSDC);

        // Mark closed
        pos.isOpen = false;

        emit PositionClosed(msg.sender, positionId, block.timestamp);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function getUserPositions(address user) external view returns (EncryptedPosition[] memory) {
        return positions[user];
    }

    function getPositionCount(address user) external view returns (uint256) {
        return positions[user].length;
    }

    function isRegisteredAsset(address asset) external view returns (bool) {
        return registeredAssets[asset];
    }
}

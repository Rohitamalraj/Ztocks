// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ZKVerifier.sol";
import "./ConfidentialTierManager.sol";
import "./SynthToken.sol";
import "./FeeModule.sol";

/// @title ConfidentialSynthVault
/// @notice Core vault for opening/closing leveraged synthetic positions.
///
///         THE NOVEL MECHANISM — Dual Privacy Stack:
///         1. ZK Layer:  User's KYC tier is verified via Groth16 ZK proof (Circom circuit).
///                       The tier is derived from on-chain credit score, signed by a trusted oracle,
///                       and proven without revealing personal data.
///         2. FHE Layer: Position data (collateral, leverage, direction, P&L) is conceptually
///                       encrypted — the contract enforces leverage caps by reading the ZK-verified
///                       tier from ZKVerifier and checking against TierManager caps.
///
///         This architecture ensures:
///         - Identity privacy (ZK proofs — no PII on-chain)
///         - Trade privacy (position parameters hidden from MEV bots)
///         - Compliance enforcement (tier-gated leverage without revealing tier value)
///
/// @dev    On Zama's fhEVM, position fields would use euint types (euint256, euint8, ebool).
///         For the hackathon demo on Sepolia, we implement the same logic with the FHE-ready
///         architecture and type annotations, deployable on standard EVM for demonstration.
contract ConfidentialSynthVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 1000; // 10%
    uint256 public constant LIQUIDATION_BONUS_BPS     = 500;  // 5% to liquidator
    uint256 public constant BPS_DENOMINATOR           = 10000;
    uint256 public constant PRICE_DECIMALS            = 1e8;  // 8 decimals

    // ─── External contracts ──────────────────────────────────────────────────
    ZKVerifier                public immutable zkVerifier;
    ConfidentialTierManager   public immutable tierManager;
    IERC20                    public immutable usdc;
    FeeModule                 public feeModule;

    // ─── State ───────────────────────────────────────────────────────────────
    /// @dev Registered synth tokens that can be traded.
    mapping(address => bool) public registeredAssets;

    /// @notice Position struct — in production fhEVM, collateralUSDC, leverage, entryPrice,
    ///         synthAmount would be euint types for full encryption. For Sepolia demo,
    ///         we use standard types with the same enforcement logic.
    struct Position {
        address asset;           // SynthToken contract address
        bool    isLong;          // true = LONG, false = SHORT
        uint256 collateralUSDC;  // USDC deposited (6 decimals)
        uint8   leverage;        // leverage multiplier (1–10)
        uint256 entryPrice;      // oracle price at open (8 decimals)
        uint256 synthAmount;     // synth tokens minted (18 decimals)
        uint256 openTime;        // block.timestamp at open
        bool    isOpen;
    }

    /// @dev user address → array of positions (append-only, closed positions kept)
    mapping(address => Position[]) public positions;

    // ─── Events ──────────────────────────────────────────────────────────────
    event PositionOpened(
        address indexed user,
        uint256 indexed positionId,
        address indexed asset,
        bool    isLong,
        uint256 collateralUSDC,
        uint8   leverage,
        uint256 entryPrice,
        uint256 synthAmount
    );

    event PositionClosed(
        address indexed user,
        uint256 indexed positionId,
        uint256 exitPrice,
        int256  pnl,
        uint256 returnedUSDC
    );

    event Liquidated(
        address indexed user,
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 exitPrice,
        uint256 liquidatorBonus
    );

    event AssetRegistered(address indexed synthToken);
    event FeeModuleUpdated(address indexed feeModule);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error NotEligible(address user);
    error LeverageExceedsTierCap(uint256 requested, uint256 cap);
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
        address usdcAddress,
        address feeModuleAddress
    ) Ownable(msg.sender) {
        require(zkVerifierAddress   != address(0), "ConfidentialSynthVault: zero zkVerifier");
        require(tierManagerAddress  != address(0), "ConfidentialSynthVault: zero tierManager");
        require(usdcAddress         != address(0), "ConfidentialSynthVault: zero usdc");

        zkVerifier  = ZKVerifier(zkVerifierAddress);
        tierManager = ConfidentialTierManager(tierManagerAddress);
        usdc        = IERC20(usdcAddress);
        feeModule   = FeeModule(feeModuleAddress);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Register a synth asset for trading (owner only).
    function registerSynthAsset(address synthToken) external onlyOwner {
        require(synthToken != address(0), "ConfidentialSynthVault: zero address");
        registeredAssets[synthToken] = true;
        emit AssetRegistered(synthToken);
    }

    /// @notice Update the fee module address (owner only).
    function setFeeModule(address feeModuleAddress) external onlyOwner {
        feeModule = FeeModule(feeModuleAddress);
        emit FeeModuleUpdated(feeModuleAddress);
    }

    /// @notice Pause all trading in an emergency.
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause trading.
    function unpause() external onlyOwner { _unpause(); }

    // ─── Core: Open Position ─────────────────────────────────────────────────

    /// @notice Open a leveraged synthetic position.
    /// @dev THE NOVEL CHECK: leverage is capped by the caller's ZK-verified KYC tier.
    ///      In production fhEVM, collateral/leverage would be encrypted euint types and
    ///      the leverage check would be: TFHE.le(encryptedLeverage, encryptedTierCap).
    function openPosition(
        address synthToken,
        bool    isLong,
        uint256 collateralUSDC,
        uint256 leverage,
        uint256 executionPrice
    ) external nonReentrant whenNotPaused {
        // 1. ZK identity check: user must have a valid, non-expired ZK proof
        if (!zkVerifier.isVerified(msg.sender)) revert NotEligible(msg.sender);

        // 2. THE KEY ENFORCEMENT: leverage must not exceed ZK-proven tier cap
        //    In fhEVM: ebool canTrade = TFHE.le(requestedLeverage, encryptedTierCap);
        //              TFHE.req(canTrade);
        (uint8 tier, ) = zkVerifier.getTier(msg.sender);
        uint8 maxLev = tierManager.getMaxLeverage(tier);
        if (leverage > maxLev) revert LeverageExceedsTierCap(leverage, maxLev);
        if (leverage == 0)     revert InvalidLeverage();
        if (executionPrice == 0) revert InvalidExecutionPrice();

        uint8 lev = uint8(leverage);

        // 3. Asset must be registered
        if (!registeredAssets[synthToken]) revert AssetNotRegistered(synthToken);

        // 4. Collateral sanity check
        if (collateralUSDC == 0) revert InsufficientCollateral();

        // 5. Pull USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), collateralUSDC);

        // 6. Collect opening fee
        if (address(feeModule) != address(0)) {
            feeModule.collectOpenFee(msg.sender, collateralUSDC);
        }

        // 7. Use API-sourced execution price
        uint256 entryPrice = executionPrice;

        // 8. Calculate position size and synth amount
        //    In fhEVM: euint256 positionSize = TFHE.mul(encCollateral, encLeverage);
        //              euint256 synthAmount = TFHE.div(TFHE.mul(positionSize, 1e20), encEntryPrice);
        uint256 positionSizeUSDC = collateralUSDC * lev;
        uint256 synthAmount = (positionSizeUSDC * 1e20) / entryPrice;

        // 9. Mint synth tokens to user
        SynthToken(synthToken).mint(msg.sender, synthAmount);

        // 10. Store position
        uint256 positionId = positions[msg.sender].length;
        positions[msg.sender].push(Position({
            asset:          synthToken,
            isLong:         isLong,
            collateralUSDC: collateralUSDC,
            leverage:       lev,
            entryPrice:     entryPrice,
            synthAmount:    synthAmount,
            openTime:       block.timestamp,
            isOpen:         true
        }));

        emit PositionOpened(
            msg.sender,
            positionId,
            synthToken,
            isLong,
            collateralUSDC,
            lev,
            entryPrice,
            synthAmount
        );
    }

    // ─── Core: Close Position ────────────────────────────────────────────────

    /// @notice Close an open position and settle P&L.
    /// @dev In fhEVM: P&L calculation uses TFHE.mul/TFHE.sub on encrypted values.
    function closePosition(uint256 positionId, uint256 executionPrice) external nonReentrant whenNotPaused {
        Position storage pos = _validatePosition(msg.sender, positionId);
        if (executionPrice == 0) revert InvalidExecutionPrice();

        uint256 exitPrice = executionPrice;
        int256 pnl = _calculatePnl(pos, exitPrice);

        // Burn synth tokens
        SynthToken(pos.asset).burn(msg.sender, pos.synthAmount);

        // Calculate return amount
        uint256 returnUSDC;
        if (pnl >= 0) {
            returnUSDC = pos.collateralUSDC + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            returnUSDC = loss >= pos.collateralUSDC ? 0 : pos.collateralUSDC - loss;
        }

        // Collect closing fee
        if (address(feeModule) != address(0) && returnUSDC > 0) {
            feeModule.collectCloseFee(msg.sender, returnUSDC);
        }

        // Mark position closed
        pos.isOpen = false;

        // Return USDC to user
        if (returnUSDC > 0) {
            usdc.safeTransfer(msg.sender, returnUSDC);
        }

        emit PositionClosed(msg.sender, positionId, exitPrice, pnl, returnUSDC);
    }

    // ─── Liquidation ─────────────────────────────────────────────────────────

    /// @notice Liquidate an unhealthy position.
    /// @dev In fhEVM: ebool isLiquidatable = TFHE.lt(healthFactor, LIQUIDATION_THRESHOLD);
    ///      TFHE.req(isLiquidatable); — enforced on encrypted health factor
    function liquidate(address user, uint256 positionId, uint256 currentPrice) external nonReentrant {
        Position storage pos = _validatePosition(user, positionId);
        if (currentPrice == 0) revert InvalidExecutionPrice();

        uint256 healthBps = _computeHealthBps(pos, currentPrice);
        if (healthBps >= LIQUIDATION_THRESHOLD_BPS) revert HealthyPosition();

        int256 pnl = _calculatePnl(pos, currentPrice);
        uint256 remainingCollateral;
        if (pnl >= 0) {
            remainingCollateral = pos.collateralUSDC + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            remainingCollateral = loss >= pos.collateralUSDC ? 0 : pos.collateralUSDC - loss;
        }

        SynthToken(pos.asset).burn(user, pos.synthAmount);
        pos.isOpen = false;

        uint256 liquidatorBonus = (remainingCollateral * LIQUIDATION_BONUS_BPS) / BPS_DENOMINATOR;
        if (liquidatorBonus > 0) {
            usdc.safeTransfer(msg.sender, liquidatorBonus);
        }

        emit Liquidated(user, positionId, msg.sender, currentPrice, liquidatorBonus);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function getHealthFactor(address user, uint256 positionId, uint256 currentPrice)
        external view returns (uint256 healthBps)
    {
        if (positionId >= positions[user].length) revert PositionNotFound(positionId);
        Position storage pos = positions[user][positionId];
        if (!pos.isOpen) return 0;
        if (currentPrice == 0) revert InvalidExecutionPrice();
        return _computeHealthBps(pos, currentPrice);
    }

    function getUserPositions(address user) external view returns (Position[] memory) {
        return positions[user];
    }

    function getPositionCount(address user) external view returns (uint256) {
        return positions[user].length;
    }

    function isRegisteredAsset(address asset) external view returns (bool) {
        return registeredAssets[asset];
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _validatePosition(address user, uint256 positionId)
        internal view returns (Position storage pos)
    {
        if (positionId >= positions[user].length) revert PositionNotFound(positionId);
        pos = positions[user][positionId];
        if (!pos.isOpen) revert PositionAlreadyClosed();
        return pos;
    }

    function _calculatePnl(Position storage pos, uint256 exitPrice)
        internal view returns (int256 pnl)
    {
        uint256 positionSizeUSDC = pos.collateralUSDC * pos.leverage;

        if (pos.isLong) {
            if (exitPrice >= pos.entryPrice) {
                uint256 gain = (positionSizeUSDC * (exitPrice - pos.entryPrice)) / pos.entryPrice;
                return int256(gain);
            } else {
                uint256 loss = (positionSizeUSDC * (pos.entryPrice - exitPrice)) / pos.entryPrice;
                return -int256(loss);
            }
        } else {
            if (exitPrice <= pos.entryPrice) {
                uint256 gain = (positionSizeUSDC * (pos.entryPrice - exitPrice)) / pos.entryPrice;
                return int256(gain);
            } else {
                uint256 loss = (positionSizeUSDC * (exitPrice - pos.entryPrice)) / pos.entryPrice;
                return -int256(loss);
            }
        }
    }

    function _computeHealthBps(Position storage pos, uint256 currentPrice)
        internal view returns (uint256)
    {
        int256 pnl = _calculatePnl(pos, currentPrice);
        uint256 positionSizeUSDC = pos.collateralUSDC * pos.leverage;

        int256 equity = int256(pos.collateralUSDC) + pnl;
        if (equity <= 0) return 0;

        return (uint256(equity) * BPS_DENOMINATOR) / positionSizeUSDC;
    }
}

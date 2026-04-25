// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984ERC20Wrapper, ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/// @title ConfidentialUSDC
/// @notice ERC7984 confidential wrapper for USDC, enabling FULLY ENCRYPTED collateral deposits.
///
///         THE NOVEL MECHANISM — End-to-End Privacy:
///         1. Users wrap USDC → cUSDC (confidential USDC)
///         2. Deposit cUSDC to vault with ENCRYPTED amounts
///         3. Open positions with ENCRYPTED collateral, leverage, and direction
///         4. Close positions and unwrap cUSDC → USDC
///
///         This architecture ensures:
///         - Collateral privacy (no one knows your deposit size)
///         - MEV protection (bots can't see your collateral to front-run liquidations)
///         - Compliance (all transactions on-chain, just encrypted)
///
/// @dev    Wrapping: ERC20 USDC → ERC7984 cUSDC (instant, encrypted balance)
///         Unwrapping: ERC7984 cUSDC → ERC20 USDC (2-step async process with decryption)
///
///         IMPORTANT: Unwrapping requires public decryption via relayer.
///         See: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper
contract ConfidentialUSDC is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    
    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param usdcToken The underlying ERC20 USDC token to wrap
    constructor(
        IERC20 usdcToken
    ) 
        ERC7984ERC20Wrapper(usdcToken) 
        ERC7984(
            "Confidential USDC",
            "cUSDC",
            "https://ztocks.io/tokens/cusdc"
        ) 
        ZamaEthereumConfig() 
    {}

    // ─── Wrapping ────────────────────────────────────────────────────────────
    
    /// @notice Wrap ERC20 USDC into confidential cUSDC.
    /// @dev    This is inherited from ERC7984ERC20Wrapper and works as follows:
    ///         1. User approves this contract to spend USDC
    ///         2. User calls depositFor(account, amount)
    ///         3. Contract transfers USDC from user using SafeERC20
    ///         4. Contract mints encrypted cUSDC to account
    ///
    ///         The minted amount is ENCRYPTED - no one can see the balance.
    ///
    /// @param account Recipient of the wrapped tokens
    /// @param amount Amount of USDC to wrap (plaintext, 6 decimals)
    /// @return success True if wrapping succeeded
    ///
    /// Example usage:
    ///   usdc.approve(address(cUSDC), 1000e6);
    ///   cUSDC.depositFor(msg.sender, 1000e6);
    // function depositFor(address account, uint256 amount) external returns (bool);
    // ^ Already implemented in ERC7984ERC20Wrapper

    // ─── Unwrapping ──────────────────────────────────────────────────────────
    
    /// @notice Unwrap confidential cUSDC back to ERC20 USDC (Step 1: Request).
    /// @dev    This is a 2-step async process:
    ///         
    ///         STEP 1 (this function): Request unwrap
    ///         - Burns encrypted cUSDC from 'from' account
    ///         - Emits UnwrapRequested event with encrypted amount
    ///         - NO USDC transfer happens yet
    ///
    ///         STEP 2 (finalizeUnwrap): Finalize unwrap
    ///         - Relayer decrypts the burned amount off-chain
    ///         - Anyone calls finalizeUnwrap(requestId, cleartextAmount, proof)
    ///         - Contract verifies decryption proof
    ///         - Contract transfers USDC to 'to' address
    ///
    /// @param from Account to unwrap from (must be msg.sender or approved operator)
    /// @param to Recipient of the unwrapped USDC
    /// @param encryptedAmount External encrypted amount to unwrap (externalEuint64)
    /// @param inputProof Proof for the encrypted input
    ///
    /// Example usage:
    ///   const enc = await fhevm.createEncryptedInput(cUSDC.address, user.address)
    ///     .add64(1000e6)
    ///     .encrypt();
    ///   await cUSDC.unwrap(user.address, user.address, enc.handles[0], enc.inputProof);
    ///   // Wait for relayer to decrypt
    ///   await cUSDC.finalizeUnwrap(requestId, 1000e6, decryptionProof);
    // function unwrap(address from, address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external;
    // ^ Already implemented in ERC7984ERC20Wrapper

    /// @notice Finalize an unwrap request (Step 2: Finalize).
    /// @dev    Called by anyone (typically a relayer) after off-chain decryption.
    ///         Verifies the decryption proof and transfers USDC to recipient.
    ///
    /// @param unwrapRequestId The request ID from UnwrapRequested event
    /// @param cleartextAmount The decrypted amount (plaintext)
    /// @param decryptionProof Proof that the decryption is correct
    // function finalizeUnwrap(bytes32 unwrapRequestId, uint64 cleartextAmount, bytes calldata decryptionProof) external;
    // ^ Already implemented in ERC7984ERC20Wrapper

    // ─── Notes ───────────────────────────────────────────────────────────────
    
    /// SECURITY CONSIDERATIONS:
    /// 1. Wrapping is instant and trustless (standard ERC20 transfer + mint)
    /// 2. Unwrapping requires relayer for decryption (introduces async dependency)
    /// 3. Decryption proofs are verified on-chain (trustless, but gas-intensive)
    /// 4. Users should monitor UnwrapRequested events and ensure finalization
    ///
    /// GAS OPTIMIZATION:
    /// - Batch multiple wraps/unwraps when possible
    /// - Consider using unwrap without inputProof if encrypted balance is known
    ///
    /// COMPLIANCE:
    /// - All transactions are on-chain and auditable
    /// - Amounts are encrypted but transaction graph is visible
    /// - Regulators can request decryption keys for specific investigations
    ///
    /// MEV PROTECTION:
    /// - Bots cannot see deposit amounts to front-run liquidations
    /// - Bots cannot see unwrap amounts to sandwich trades
    /// - Position sizes remain hidden throughout lifecycle
}

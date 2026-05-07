"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useWalletClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { maxUint256, parseEventLogs, parseUnits } from "viem";
import { sepolia } from "wagmi/chains";
import { toast } from "sonner";
import { waitForHash } from "@/lib/tx-utils";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS, ASSET_TOKENS, TOKEN_SYMBOL } from "@/lib/contracts";
import { SYNTH_VAULT_ABI, ERC20_ABI, CUSDC_ABI, ZK_VERIFIER_ABI } from "@/lib/abis";
import {
  buildEncryptedVaultInputs,
  buildEncryptedEuint64,
  decryptEbool,
  decryptEuint64,
  decryptEuint8,
} from "@/lib/fhe";
import type { Hex } from "viem";
import type { AssetSymbol } from "@/hooks/use-asset-quotes";
import type { Direction } from "@/hooks/use-positions";

export type TxStatus =
  | "idle"
  | "preparing"
  | "approving-usdc"
  | "wrapping"
  | "setting-operator"
  | "opening"
  | "closing"
  | "unwrap-requesting"
  | "unwrap-wait-relayer"
  | "unwrap-finalizing"
  | "success"
  | "error";

export interface OnChainPosition {
  id:             string;
  index:          number;
  asset:          AssetSymbol;
  direction:      "LONG" | "SHORT";
  isLong:         boolean;
  collateralUSDC: number;
  leverage:       number;
  entryPrice:     number;
  openedAt:       Date;
  isOpen:         boolean;
}

function toExecutionPriceE8(price: number): bigint {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Live API price unavailable. Please wait for market price refresh and try again.")
  }
  return parseUnits(price.toFixed(8), 8)
}

function extractTxMessage(err: unknown): string {
  if (!err) return "Transaction failed"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message

  const maybe = err as {
    message?: string
    shortMessage?: string
    details?: string
    cause?: unknown
  }

  if (maybe.shortMessage) return maybe.shortMessage
  if (maybe.details) return maybe.details
  if (maybe.message) return maybe.message
  if (maybe.cause) return extractTxMessage(maybe.cause)

  return "Transaction failed"
}

function toFriendlyTxMessage(err: unknown): string {
  const raw = extractTxMessage(err)
  const msg = raw.toLowerCase()

  if (msg.includes("invalidexecutionprice") || msg.includes("execution price")) {
    return "Live API price unavailable. Please wait for a quote refresh and retry."
  }
  if (msg.includes("pricestale") || msg.includes("price stale") || msg.includes("stale")) {
    return "Live API price is available, but trade execution is temporarily unavailable. Please retry shortly."
  }
  if (msg.includes("assetnotregistered") || msg.includes("asset not registered")) {
    return "This asset is not registered in the trading vault on the deployed contracts."
  }
  if (msg.includes("noteligible") || msg.includes("not eligible") || msg.includes("isverified")) {
    return "Identity verification required. Click 'Verify Identity' in the header first."
  }
  if (msg.includes("leverageexceedstiercap") || msg.includes("exceeds tier cap")) {
    return "Leverage exceeds your tier cap. Reduce leverage or verify a higher tier."
  }
  if (msg.includes("erc7984unauthorizedspender") || msg.includes("unauthorized spender") || msg.includes("operator")) {
    return "cUSDC operator approval required. Please approve the vault as an operator and retry."
  }
  if (msg.includes("insufficient usdc")) {
    return raw
  }
  if (msg.includes("transfer amount exceeds balance") || msg.includes("insufficient") || msg.includes("balance")) {
    return "Insufficient USDC balance. Please top up and retry."
  }
  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected")) {
    return "Transaction cancelled by user."
  }
  if (msg.includes("allowance") || msg.includes("insufficient allowance")) {
    return "Token approval failed. Please try again."
  }
  if (msg.includes("not_ready") || msg.includes("not ready for decryption")) {
    return "Relayer is preparing public decryption. Wait a few seconds and retry finalize."
  }
  if (msg.includes("aborted") || msg.includes("abort")) {
    return "Encryption request timed out. Please retry once."
  }

  return raw.slice(0, 180)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function readClearU64FromDecrypt(
  clearValues: Readonly<Record<Hex, bigint | boolean | Hex>>,
  handle: Hex,
): bigint {
  const lower = handle.toLowerCase() as Hex
  for (const key of [handle, lower]) {
    const v = clearValues[key]
    if (typeof v === "bigint") return v
  }
  for (const v of Object.values(clearValues)) {
    if (typeof v === "bigint") return v
  }
  throw new Error("Relayer did not return a cleartext unwrap amount.")
}

export function useVault() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txError, setTxError]   = useState<string | null>(null);
  const [allPositions, setAllPositions] = useState<OnChainPosition[]>([]);
  const openPositionInFlightRef = useRef(false);

  const { writeContractAsync } = useWriteContract();

  const { data: rawPositions, refetch: refetchPositions } = useReadContract({
    address: CONTRACTS.SynthVault as `0x${string}`,
    abi: SYNTH_VAULT_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.SynthVault },
  });

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDC },
  });

  const { data: usdcAllowance } = useReadContract({
    address: CONTRACTS.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    // Full confidential flow wraps USDC -> cUSDC, so allowance must target cUSDC.
    args: address ? [address, CONTRACTS.CUSDC as `0x${string}`] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDC && !!CONTRACTS.CUSDC },
  });

  const { data: operatorApproved } = useReadContract({
    address: CONTRACTS.CUSDC as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: "isOperator",
    args: address ? [address, CONTRACTS.SynthVault as `0x${string}`] : undefined,
    query: { enabled: !!address && !!CONTRACTS.CUSDC && !!CONTRACTS.SynthVault },
  });

  const openPosition = useCallback(async (
    asset: AssetSymbol,
    direction: Direction,
    collateralNum: number,
    leverage: number,
    executionPriceNum: number
  ) => {
    if (!address) return false;
    if (openPositionInFlightRef.current) {
      const inFlightMsg = "Trade already in progress. Please wait for the current flow to finish.";
      setTxError(inFlightMsg);
      toast.error("Transaction in progress", { id: "tx", description: inFlightMsg });
      return false;
    }
    openPositionInFlightRef.current = true;
    setTxError(null);

    try {
      const collateralBn = parseUnits(String(collateralNum), 6);
      const executionPrice = toExecutionPriceE8(executionPriceNum)
      const tokenAddress = ASSET_TOKENS[asset];
      if (!tokenAddress) {
        throw new Error(`Trading for ${asset} is not enabled yet on the deployed contracts.`);
      }
      if (!CONTRACTS.USDC) {
        throw new Error("USDC address not configured. Set NEXT_PUBLIC_USDC_ADDRESS and retry.");
      }
      if (!CONTRACTS.SynthVault) {
        throw new Error("Vault address not configured. Set NEXT_PUBLIC_SYNTH_VAULT_ADDRESS and retry.");
      }
      // Hard preflight against the currently deployed verifier used by this frontend build.
      // Prevents wasting wrap/lock txs if the wallet has not re-verified after redeploy.
      if (CONTRACTS.ZKVerifier) {
        const { readContract } = await import("@wagmi/core");
        const verified = await readContract(wagmiConfig, {
          address: CONTRACTS.ZKVerifier as `0x${string}`,
          abi: ZK_VERIFIER_ABI,
          functionName: "isVerified",
          args: [address],
        }) as boolean;
        if (!verified) {
          throw new Error("Identity verification required on current deployment. Click Verify first.");
        }
      }
      console.group(`%c[Ztocks:vault] openPosition`, "color:#34d399;font-weight:bold");
      console.log("Asset:", asset, "| Direction:", direction, "| Collateral:", collateralNum, "USDC | Leverage:", leverage + "x", "| API Price:", executionPriceNum);
      
      // ── Pre-flight checks ────────────────────────────────────────────
      console.log("[Pre-flight] Checking balances and approvals...");
      
      // Check USDC balance
      if (!usdcBalance || usdcBalance < collateralBn) {
        throw new Error(`Insufficient USDC balance. You have ${Number(usdcBalance || 0n) / 1e6} USDC but need ${collateralNum} USDC.`);
      }
      console.log("[Pre-flight] ✓ USDC balance sufficient:", Number(usdcBalance) / 1e6, "USDC");
      
      // Check USDC allowance for cUSDC wrapping (must be prepared beforehand)
      console.log("[Pre-flight] USDC allowance:", usdcAllowance?.toString(), "| Required:", collateralBn.toString());
      if (!usdcAllowance || usdcAllowance < collateralBn) {
        throw new Error("Trading allowance not ready. Click 'Enable Trading' in the top-right first.");
      }
      if (!operatorApproved) {
        throw new Error("cUSDC operator approval missing. Click 'Enable Trading' in the top-right first.");
      }
      console.log("[1/4] Trading approvals ready");

      // Step 2: wrap USDC -> cUSDC
      setTxStatus("wrapping");
      console.log("[2/4] Wrapping USDC into cUSDC...");
      const wrapHash = await writeContractAsync({
        address: CONTRACTS.CUSDC as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "wrap",
        args: [address, collateralBn],
        chainId: sepolia.id,
      });
      await waitForHash(wrapHash);
      console.log("[2/4] ✓ cUSDC wrapped", wrapHash);

      // Step 3: lock encrypted collateral in vault
      const encCollateral = await buildEncryptedEuint64({
        // lockCollateralConfidential forwards encrypted amount to cUSDC
        // confidentialTransferFrom, so proof must be bound to cUSDC.
        contractAddress: CONTRACTS.CUSDC,
        // cUSDC.fromExternal is executed inside a call initiated by the vault.
        // Bind the input to vault caller context for this forwarded transfer.
        userAddress: CONTRACTS.SynthVault as `0x${string}`,
        amount: collateralBn,
      });
      console.log("[3/4] Locking encrypted collateral in vault...");
      const lockHash = await writeContractAsync({
        address: CONTRACTS.SynthVault as `0x${string}`,
        abi: SYNTH_VAULT_ABI,
        functionName: "lockCollateralConfidential",
        args: [encCollateral.handles[0], encCollateral.inputProof],
        chainId: sepolia.id,
        gas: 12_000_000n,
      });
      await waitForHash(lockHash);
      console.log("[3/4] ✓ Collateral locked", lockHash);

      // Step 4: open encrypted position from locked collateral
      const encrypted = await buildEncryptedVaultInputs({
        contractAddress: CONTRACTS.SynthVault,
        userAddress: address,
        isLong: direction === "LONG",
        collateral: collateralBn,
        leverage,
        executionPrice,
      });

      setTxStatus("opening");
      console.log("[4/4] Calling SynthVault.openPositionFromLocked...");
      toast.loading("Opening position...", { id: "tx" });
      const hash = await writeContractAsync({
        address: CONTRACTS.SynthVault as `0x${string}`,
        abi: SYNTH_VAULT_ABI,
        functionName: "openPositionFromLocked",
        args: [
          tokenAddress,
          encrypted.handles[0], // isLong
          encrypted.handles[2], // leverage
          encrypted.handles[3], // executionPrice
          encrypted.inputProof,
        ],
        chainId: sepolia.id,
        gas: 12_000_000n,
      });
      console.log("[3/3] Tx submitted:", hash);
      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      console.log("[3/3] ✓ Position tx confirmed", hash);

      // Step 5: mint confidential synth in a separate tx (keeps open tx lightweight).
      const vaultLc = (CONTRACTS.SynthVault as string).toLowerCase();
      const opened = parseEventLogs({
        abi: SYNTH_VAULT_ABI,
        logs: receipt.logs.filter((l) => l.address.toLowerCase() === vaultLc),
        eventName: "PositionOpened",
      });
      const positionId = opened[0]?.args.positionId as bigint | undefined;
      if (positionId !== undefined) {
        console.log("[5/5] Claiming confidential synth...");
        const claimHash = await writeContractAsync({
          address: CONTRACTS.SynthVault as `0x${string}`,
          abi: SYNTH_VAULT_ABI,
          functionName: "claimSynthForPosition",
          args: [positionId],
          chainId: sepolia.id,
          gas: 12_000_000n,
        });
        await waitForHash(claimHash);
        console.log("[5/5] ✓ Synth claimed", claimHash);
      } else {
        console.warn("[Ztocks:vault] PositionOpened log missing; skipping synth claim step");
      }
      await refetchPositions();
      setTxStatus("success");
      toast.success("Position opened", { id: "tx" });
      setTimeout(() => setTxStatus("idle"), 2500);
      console.groupEnd();
      return true;
    } catch (err: unknown) {
      const msg = toFriendlyTxMessage(err)
      
      console.error("[Ztocks:vault] ✗ openPosition error:", err);
      console.groupEnd();
      setTxError(msg);
      setTxStatus("error");
      toast.error("Transaction failed", { id: "tx", description: msg });
      setTimeout(() => setTxStatus("idle"), 5000);
      return false;
    } finally {
      openPositionInFlightRef.current = false;
    }
  }, [address, usdcBalance, usdcAllowance, operatorApproved, writeContractAsync, refetchPositions]);

  const prepareTradingApprovals = useCallback(async () => {
    if (!address) return false;
    setTxError(null);
    try {
      if (!CONTRACTS.USDC || !CONTRACTS.CUSDC || !CONTRACTS.SynthVault) {
        throw new Error("Trading contracts are not configured.");
      }
      setTxStatus("preparing");
      toast.loading("Enabling trading approvals...", { id: "tx-prepare" });
      const approveHash = await writeContractAsync({
        address: CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.CUSDC as `0x${string}`, maxUint256],
        chainId: sepolia.id,
      });
      await waitForHash(approveHash);
      const until = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);
      const operatorHash = await writeContractAsync({
        address: CONTRACTS.CUSDC as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "setOperator",
        args: [CONTRACTS.SynthVault as `0x${string}`, until],
        chainId: sepolia.id,
      });
      await waitForHash(operatorHash);
      setTxStatus("success");
      toast.success("Trading approvals enabled", { id: "tx-prepare" });
      setTimeout(() => setTxStatus("idle"), 2500);
      return true;
    } catch (err: unknown) {
      const msg = toFriendlyTxMessage(err);
      console.error("[Ztocks:vault] prepareTradingApprovals error:", err);
      setTxError(msg);
      setTxStatus("error");
      toast.error("Enable trading failed", { id: "tx-prepare", description: msg });
      setTimeout(() => setTxStatus("idle"), 5000);
      return false;
    }
  }, [address, writeContractAsync]);

  const closePosition = useCallback(async (index: number, executionPriceNum: number) => {
    if (!address) return;
    setTxError(null);

    try {
      setTxStatus("closing");
      const executionPrice = toExecutionPriceE8(executionPriceNum)
      console.log("[Ztocks:vault] closePosition index:", index);
      toast.loading("Closing position...", { id: "tx-close" });
      const hash = await writeContractAsync({
        address: CONTRACTS.SynthVault as `0x${string}`,
        abi: SYNTH_VAULT_ABI,
        functionName: "closePosition",
        args: [BigInt(index), executionPrice],
        chainId: sepolia.id,
      });
      console.log("[Ztocks:vault] closePosition tx:", hash);
      await waitForHash(hash);
      console.log("[Ztocks:vault] ✓ closePosition confirmed:", hash);
      await refetchPositions();
      setTxStatus("success");
      toast.success("Position closed", { id: "tx-close" });
      setTimeout(() => setTxStatus("idle"), 2500);
    } catch (err: unknown) {
      const msg = toFriendlyTxMessage(err);
      console.error("[Ztocks:vault] ✗ closePosition error:", err);
      setTxError(msg);
      setTxStatus("error");
      toast.error("Transaction failed", { id: "tx-close", description: msg });
      setTimeout(() => setTxStatus("idle"), 3000);
    }
  }, [address, writeContractAsync, refetchPositions]);

  /**
   * Two-step ERC-7984 unwrap (Zama): encrypted burn + relayer public decrypt + finalize.
   * @see https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper
   */
  const unwrapCUSDC = useCallback(async (amountNum: number) => {
    if (!address) return false;
    setTxError(null);

    if (!CONTRACTS.CUSDC) {
      toast.error("cUSDC address not configured.");
      return false;
    }

    const collateralBn = parseUnits(String(amountNum), 6);
    try {
      setTxStatus("unwrap-requesting");
      toast.loading("Requesting cUSDC unwrap (step 1/2)…", { id: "tx-unwrap" });

      const encrypted = await buildEncryptedEuint64({
        contractAddress: CONTRACTS.CUSDC,
        userAddress:     address,
        amount:           collateralBn,
      });

      const hash = await writeContractAsync({
        address: CONTRACTS.CUSDC as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "unwrap",
        args: [address, address, encrypted.handles[0], encrypted.inputProof],
        chainId: sepolia.id,
      });

      const { waitForTransactionReceipt } = await import("@wagmi/core");
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      const cusdcLc = (CONTRACTS.CUSDC as string).toLowerCase();
      const logs = parseEventLogs({
        abi: CUSDC_ABI,
        logs: receipt.logs.filter((l) => l.address.toLowerCase() === cusdcLc),
        eventName: "UnwrapRequested",
      });

      const unwrapRequestId = logs[0]?.args.unwrapRequestId as Hex | undefined;
      if (!unwrapRequestId) {
        throw new Error("UnwrapRequested event not found — check explorer for this tx.");
      }

      setTxStatus("unwrap-wait-relayer");
      toast.loading("Waiting on Zama relayer for public decryption…", { id: "tx-unwrap" });

      const handle = unwrapRequestId.toLowerCase() as Hex;
      let clearAmount: bigint | undefined;
      let decryptionProof: Hex | undefined;

      for (let attempt = 0; attempt < 24; attempt++) {
        try {
          const res = await fetch("/api/fhe/public-decrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handles: [handle] }),
          });
          const data = (await res.json()) as {
            error?: string;
            decryptionProof?: Hex;
            clearValues?: Record<string, string>;
          };
          if (!res.ok || data.error) {
            throw new Error(data.error ?? res.statusText);
          }

          const asMap = {} as Record<Hex, bigint | boolean | Hex>;
          if (data.clearValues) {
            for (const [k, v] of Object.entries(data.clearValues)) {
              const key = k.toLowerCase() as Hex;
              try {
                asMap[key] = BigInt(v);
              } catch {
                asMap[key] = v as Hex;
              }
            }
          }
          decryptionProof = data.decryptionProof as Hex;
          clearAmount = readClearU64FromDecrypt(asMap, handle);
          break;
        } catch (e) {
          const m = extractTxMessage(e).toLowerCase();
          if (attempt === 23) throw e;
          if (
            m.includes("not_ready") ||
            m.includes("not allowed") ||
            m.includes("acl") ||
            m.includes("502") ||
            m.includes("bad gateway")
          ) {
            await sleep(2000);
            continue;
          }
          throw e;
        }
      }

      if (clearAmount === undefined || !decryptionProof) {
        throw new Error("Public decryption did not complete. Retry in a few seconds.");
      }

      setTxStatus("unwrap-finalizing");
      toast.loading("Finalizing unwrap to USDC (step 2/2)…", { id: "tx-unwrap" });

      const finHash = await writeContractAsync({
        address: CONTRACTS.CUSDC as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "finalizeUnwrap",
        args: [unwrapRequestId, clearAmount, decryptionProof],
        chainId: sepolia.id,
      });
      await waitForHash(finHash);

      void queryClient.invalidateQueries();

      setTxStatus("success");
      toast.success("USDC received in your wallet", { id: "tx-unwrap" });
      setTimeout(() => setTxStatus("idle"), 2500);
      return true;
    } catch (err: unknown) {
      const msg = toFriendlyTxMessage(err);
      console.error("[Ztocks:vault] unwrapCUSDC:", err);
      setTxError(msg);
      setTxStatus("error");
      toast.error("Unwrap failed", { id: "tx-unwrap", description: msg });
      setTimeout(() => setTxStatus("idle"), 5000);
      return false;
    }
  }, [address, writeContractAsync, queryClient]);

  const resetTxState = useCallback(() => {
    console.log("[Ztocks:vault] Manually resetting transaction state");
    setTxStatus("idle");
    setTxError(null);
    toast.dismiss("tx");
    toast.dismiss("tx-close");
    toast.dismiss("tx-unwrap");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydratePositions() {
      if (!rawPositions || !address || !walletClient) {
        if (!cancelled) setAllPositions([]);
        return;
      }

      const contractAddress = CONTRACTS.SynthVault as `0x${string}`;
      const next = await Promise.all(
        (rawPositions as any[]).map(async (p, i) => {
          const [isLong, collateralUSDC, leverageRaw, entryPrice] = await Promise.all([
            decryptEbool(p.isLong, contractAddress, walletClient),
            decryptEuint64(p.collateralUSDC, contractAddress, walletClient),
            decryptEuint8(p.leverage, contractAddress, walletClient),
            decryptEuint64(p.entryPrice, contractAddress, walletClient),
          ]);

          const leverageNum = leverageRaw ? Number(leverageRaw) : 0;
          const isLongFlag = isLong ?? true;
          return {
            id:             String(i),
            index:          i,
            asset:          TOKEN_SYMBOL[p.asset.toLowerCase()] ?? "sAAPL",
            direction:      (isLongFlag ? "LONG" : "SHORT") as "LONG" | "SHORT",
            isLong:         isLongFlag,
            collateralUSDC: collateralUSDC ? Number(collateralUSDC) / 1e6 : 0,
            leverage:       leverageNum > 0 ? leverageNum : 1,
            entryPrice:     entryPrice ? Number(entryPrice) / 1e8 : 0,
            openedAt:       new Date(Number(p.openTime) * 1000),
            isOpen:         p.isOpen,
          } as OnChainPosition;
        })
      );

      if (!cancelled) setAllPositions(next);
    }

    void hydratePositions();

    return () => {
      cancelled = true;
    };
  }, [rawPositions, address, walletClient]);

  const positions = allPositions.filter((p) => p.isOpen);

  return {
    allPositions,
    positions,
    openPosition,
    closePosition,
    unwrapCUSDC,
    prepareTradingApprovals,
    resetTxState,
    txStatus,
    txError,
    usdcBalance: usdcBalance ? Number(usdcBalance) / 1e6 : 0,
    isTradingPrepared: !!usdcAllowance && usdcAllowance > 0n && !!operatorApproved,
    refetchPositions,
  };
}


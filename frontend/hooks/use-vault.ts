"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useWalletClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { maxUint256, parseUnits } from "viem";
import { toast } from "sonner";
import { waitForHash } from "@/lib/tx-utils";
import { CONTRACTS, ASSET_TOKENS, TOKEN_SYMBOL } from "@/lib/contracts";
import { SYNTH_VAULT_ABI, ERC20_ABI, CUSDC_ABI } from "@/lib/abis";
import { buildEncryptedVaultInputs, decryptEbool, decryptEuint64, decryptEuint8 } from "@/lib/fhe";
import type { AssetSymbol } from "@/hooks/use-mock-prices";
import type { Direction } from "@/hooks/use-positions";

export type TxStatus =
  | "idle"
  | "approving-usdc"
  | "wrapping"
  | "setting-operator"
  | "opening"
  | "closing"
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

  return raw.slice(0, 180)
}

export function useVault() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txError, setTxError]   = useState<string | null>(null);
  const [allPositions, setAllPositions] = useState<OnChainPosition[]>([]);

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
    setTxError(null);

    try {
      const collateralBn = parseUnits(String(collateralNum), 6);
      const executionPrice = toExecutionPriceE8(executionPriceNum)
      const tokenAddress = ASSET_TOKENS[asset];
      if (!tokenAddress) {
        throw new Error(`Trading for ${asset} is not enabled yet on the deployed contracts.`);
      }
      if (!CONTRACTS.CUSDC) {
        throw new Error("cUSDC address not configured. Set NEXT_PUBLIC_CUSDC_ADDRESS and retry.");
      }
      if (!CONTRACTS.USDC) {
        throw new Error("USDC address not configured. Set NEXT_PUBLIC_USDC_ADDRESS and retry.");
      }
      if (!CONTRACTS.SynthVault) {
        throw new Error("Vault address not configured. Set NEXT_PUBLIC_SYNTH_VAULT_ADDRESS and retry.");
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
      
      // Check USDC allowance for cUSDC wrap
      console.log("[Pre-flight] USDC allowance:", usdcAllowance?.toString(), "| Required:", collateralBn.toString());

      // ── Step 1: approve USDC → cUSDC if needed ──────────────────────
      if (!usdcAllowance || usdcAllowance < collateralBn) {
        setTxStatus("approving-usdc");
        console.log("[1/4] Approving USDC for cUSDC wrap...");
        toast.loading("Approving USDC for cUSDC wrap...", { id: "tx" });
        const hash = await writeContractAsync({
          address: CONTRACTS.USDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACTS.CUSDC as `0x${string}`, maxUint256],
        });
        await waitForHash(hash);
        console.log("[1/4] ✓ USDC approved", hash);
        toast.success("USDC approved", { id: "tx" });
      } else {
        console.log("[1/4] USDC already approved, skipping");
      }

      // ── Step 2: wrap USDC → cUSDC ───────────────────────────────────
      setTxStatus("wrapping");
      console.log("[2/4] Wrapping USDC into cUSDC...");
      toast.loading("Wrapping USDC into cUSDC...", { id: "tx" });
      const wrapHash = await writeContractAsync({
        address: CONTRACTS.CUSDC as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "wrap",
        args: [address, collateralBn],
      });
      await waitForHash(wrapHash);
      console.log("[2/4] ✓ cUSDC wrapped", wrapHash);

      // ── Step 3: approve vault as cUSDC operator ─────────────────────
      if (!operatorApproved) {
        setTxStatus("setting-operator");
        console.log("[3/4] Setting cUSDC operator...");
        toast.loading("Approving vault operator...", { id: "tx" });
        const until = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7);
        const operatorHash = await writeContractAsync({
          address: CONTRACTS.CUSDC as `0x${string}`,
          abi: CUSDC_ABI,
          functionName: "setOperator",
          args: [CONTRACTS.SynthVault as `0x${string}`, until],
        });
        await waitForHash(operatorHash);
        console.log("[3/4] ✓ Operator approved", operatorHash);
      }

      // ── Step 4: encrypt inputs + openPosition ───────────────────────
      const encrypted = await buildEncryptedVaultInputs({
        contractAddress: CONTRACTS.SynthVault,
        userAddress: address,
        isLong: direction === "LONG",
        collateral: collateralBn,
        leverage,
        executionPrice,
      });

      setTxStatus("opening");
      console.log("[4/4] Calling SynthVault.openPosition...");
      toast.loading("Opening position...", { id: "tx" });
      const hash = await writeContractAsync({
        address: CONTRACTS.SynthVault as `0x${string}`,
        abi: SYNTH_VAULT_ABI,
        functionName: "openPosition",
        args: [
          tokenAddress,
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.handles[3],
          encrypted.inputProof,
        ],
      });
      console.log("[3/3] Tx submitted:", hash);
      await waitForHash(hash);
      console.log("[3/3] ✓ Position tx confirmed", hash);
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
    }
  }, [address, usdcBalance, usdcAllowance, operatorApproved, writeContractAsync, refetchPositions]);

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

  const resetTxState = useCallback(() => {
    console.log("[Ztocks:vault] Manually resetting transaction state");
    setTxStatus("idle");
    setTxError(null);
    toast.dismiss("tx");
    toast.dismiss("tx-close");
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
    resetTxState,
    txStatus,
    txError,
    usdcBalance: usdcBalance ? Number(usdcBalance) / 1e6 : 0,
    refetchPositions,
  };
}


"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { maxUint256, parseUnits } from "viem";
import { toast } from "sonner";
import { waitForHash } from "@/lib/tx-utils";
import { CONTRACTS, ASSET_TOKENS, TOKEN_SYMBOL } from "@/lib/contracts";
import { SYNTH_VAULT_ABI, ERC20_ABI, FEE_MODULE_ABI } from "@/lib/abis";
import type { AssetSymbol } from "@/hooks/use-mock-prices";
import type { Direction } from "@/hooks/use-positions";

export type TxStatus = "idle" | "approving-usdc" | "approving-hsp" | "opening" | "closing" | "success" | "error";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

  if (msg.includes("erc20insufficientbalance") && msg.includes(CONTRACTS.SynthVault.toLowerCase())) {
    return "Vault has insufficient USDC liquidity to pay profitable close P&L. Testnet vault needs a USDC top-up."
  }

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
  if (msg.includes("insufficient usdc")) {
    return raw
  }
  if (msg.includes("transfer amount exceeds balance") || msg.includes("insufficient") || msg.includes("balance")) {
    return "Insufficient fee token balance. Click 'Get Test Tokens' to mint tokens."
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
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txError, setTxError]   = useState<string | null>(null);
  const feeModuleAddress = CONTRACTS.FeeModule as `0x${string}`;
  const feeModuleEnabled = feeModuleAddress.toLowerCase() !== ZERO_ADDRESS;

  const { writeContractAsync } = useWriteContract();

  const { data: feeModuleHspToken } = useReadContract({
    address: feeModuleAddress,
    abi: FEE_MODULE_ABI,
    functionName: "feeToken",
    query: { enabled: feeModuleEnabled },
  });

  const feeTokenAddress = feeModuleHspToken as `0x${string}` | undefined;

  const { data: rawPositions, refetch: refetchPositions } = useReadContract({
    address: CONTRACTS.SynthVault as `0x${string}`,
    abi: SYNTH_VAULT_ABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcAllowance } = useReadContract({
    address: CONTRACTS.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.SynthVault as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: hspAllowance } = useReadContract({
    address: feeTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && feeTokenAddress ? [address, feeModuleAddress] : undefined,
    query: { enabled: !!address && feeModuleEnabled && !!feeTokenAddress },
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
      console.group(`%c[Ztocks:vault] openPosition`, "color:#34d399;font-weight:bold");
      console.log("Asset:", asset, "| Direction:", direction, "| Collateral:", collateralNum, "USDC | Leverage:", leverage + "x", "| API Price:", executionPriceNum);
      
      // ── Pre-flight checks ────────────────────────────────────────────
      console.log("[Pre-flight] Checking balances and approvals...");
      
      // Check USDC balance
      if (!usdcBalance || usdcBalance < collateralBn) {
        throw new Error(`Insufficient USDC balance. You have ${Number(usdcBalance || 0n) / 1e6} USDC but need ${collateralNum} USDC. Click "Get Test Tokens" to mint more.`);
      }
      console.log("[Pre-flight] ✓ USDC balance sufficient:", Number(usdcBalance) / 1e6, "USDC");
      
      // Check USDC allowance
      console.log("[Pre-flight] USDC allowance:", usdcAllowance?.toString(), "| Required:", collateralBn.toString());

      // ── Step 1: approve USDC → vault if needed ──────────────────────
      if (!usdcAllowance || usdcAllowance < collateralBn) {
        setTxStatus("approving-usdc");
        console.log("[1/3] Approving USDC...");
        toast.loading("Approving USDC...", { id: "tx" });
        const hash = await writeContractAsync({
          address: CONTRACTS.MockUSDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACTS.SynthVault as `0x${string}`, maxUint256],
        });
        await waitForHash(hash);
        console.log("[1/3] ✓ USDC approved", hash);
        toast.success("USDC approved", { id: "tx" });
      } else {
        console.log("[1/3] USDC already approved, skipping");
      }

      // ── Step 2: approve fee token → feeModule if needed ────────────
      if (feeModuleEnabled) {
        if (!feeTokenAddress) {
          throw new Error("Fee token address not loaded yet. Please wait a moment and retry.");
        }

        if (!hspAllowance || hspAllowance === 0n) {
          setTxStatus("approving-hsp");
          console.log("[2/3] Approving fee token...");
          toast.loading("Approving fee token...", { id: "tx" });
          const hash = await writeContractAsync({
            address: feeTokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [feeModuleAddress, maxUint256],
          });
          await waitForHash(hash);
          console.log("[2/3] ✓ Fee token approved", hash);
          toast.success("Fee token approved", { id: "tx" });
        } else {
          console.log("[2/3] Fee token already approved, skipping");
        }
      }

      // ── Step 3: openPosition ─────────────────────────────────────────
      setTxStatus("opening");
      console.log("[3/3] Calling SynthVault.openPosition...");
      toast.loading("Opening position...", { id: "tx" });
      const hash = await writeContractAsync({
        address: CONTRACTS.SynthVault as `0x${string}`,
        abi: SYNTH_VAULT_ABI,
        functionName: "openPosition",
        args: [
          tokenAddress,
          direction === "LONG",
          collateralBn,
          BigInt(leverage),
          executionPrice,
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
  }, [address, usdcBalance, usdcAllowance, hspAllowance, feeTokenAddress, feeModuleAddress, feeModuleEnabled, writeContractAsync, refetchPositions]);

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

  const allPositions: OnChainPosition[] = (rawPositions ?? [])
    .map((p, i) => {
      const collateralUSDC = Number(p.collateralUSDC) / 1e6;
      const entryPrice     = Number(p.entryPrice) / 1e8;
      const leverageRaw    = Number(p.leverage);
      const leverage       = Number.isFinite(leverageRaw) && leverageRaw > 0 ? leverageRaw : 1;
      return {
        id:             String(i),
        index:          i,
        asset:          TOKEN_SYMBOL[p.asset.toLowerCase()] ?? "sAAPL",
        direction:      (p.isLong ? "LONG" : "SHORT") as "LONG" | "SHORT",
        isLong:         p.isLong,
        collateralUSDC,
        leverage,
        entryPrice,
        openedAt:       new Date(Number(p.openTime) * 1000),
        isOpen:         p.isOpen,
      };
    });

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


"use client";

import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { ZK_VERIFIER_ABI } from "@/lib/abis";
import type { TierKey } from "@/components/dashboard/dashboard-nav";

function capToTierKey(cap: number): TierKey {
  if (cap >= 10) return "ULTIMATE";
  if (cap >= 8)  return "PREMIUM";
  if (cap >= 5)  return "ADVANCED";
  return "BASIC";
}

/** @deprecated Use useZkIdentity from hooks/use-zk-identity.ts instead */
export function useKycTier() {
  const { address, isConnected } = useAccount();

  const { data: tierData, isLoading } = useReadContract({
    address: CONTRACTS.ZKVerifier as `0x${string}`,
    abi: ZK_VERIFIER_ABI,
    functionName: "getTier",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const [tier] = (tierData as [number, bigint] | undefined) ?? [0, 0n];
  const capMap: Record<number, number> = { 1: 2, 2: 5, 3: 8, 4: 10 };
  const cap = capMap[tier] ?? 0;

  return {
    isConnected,
    address,
    isEligible: tier > 0,
    leverageCap: cap,
    tierKey: cap > 0 ? capToTierKey(cap) : "BASIC" as TierKey,
    isLoading,
  };
}

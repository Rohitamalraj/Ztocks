"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, parseEther } from "viem";
import { toast } from "sonner";
import { Droplets, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTRACTS } from "@/lib/contracts";
import { MOCK_TOKEN_ABI, FEE_MODULE_ABI } from "@/lib/abis";
import { waitForHash } from "@/lib/tx-utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function FaucetButton() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);
  const feeModuleAddress = CONTRACTS.FeeModule as `0x${string}`;
  const feeModuleEnabled = feeModuleAddress.toLowerCase() !== ZERO_ADDRESS;

  const { data: feeModuleHspToken } = useReadContract({
    address: feeModuleAddress,
    abi: FEE_MODULE_ABI,
    functionName: "feeToken",
    query: { enabled: feeModuleEnabled },
  });

  const feeTokenAddress = (feeModuleHspToken as `0x${string}` | undefined) ?? (CONTRACTS.MockFeeToken as `0x${string}`);

  if (!isConnected || !address) return null;

  const handleFaucet = async () => {
    setLoading(true);
    toast.loading("Minting test tokens...", { id: "faucet" });
    try {
      if (feeModuleEnabled && !feeModuleHspToken) {
        throw new Error("Fee token address is still loading. Please retry in a second.");
      }

      const h1 = await writeContractAsync({
        address: CONTRACTS.MockUSDC as `0x${string}`,
        abi: MOCK_TOKEN_ABI,
        functionName: "faucet",
        args: [address, parseUnits("10000", 6)],
      });
      await waitForHash(h1);

      const h2 = await writeContractAsync({
        address: feeTokenAddress,
        abi: MOCK_TOKEN_ABI,
        functionName: "faucet",
        args: [address, parseEther("10000")],
      });
      await waitForHash(h2);

      toast.success("10,000 USDC + 10,000 Fee Tokens minted!", { id: "faucet" });
    } catch (err: unknown) {
      toast.error("Faucet failed", {
        id: "faucet",
        description: err instanceof Error ? err.message.slice(0, 100) : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFaucet}
      disabled={loading}
      variant="outline"
      size="sm"
      className="h-8 px-3 font-mono text-xs border-foreground/20 hover:border-foreground/50 gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Droplets className="w-3 h-3" />
      )}
      {loading ? "Minting..." : "Get Test Tokens"}
    </Button>
  );
}

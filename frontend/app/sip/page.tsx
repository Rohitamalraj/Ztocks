"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { AppNav } from "@/components/app/app-nav";
import { PortfolioSipSection } from "@/components/dashboard/portfolio-sip-section";
import { SipPlannerPanel } from "@/components/dashboard/sip-planner-panel";
import { useAssetQuotes } from "@/hooks/use-asset-quotes";
import { useSipPlans } from "@/hooks/use-sip-plans";
import { useVault } from "@/hooks/use-vault";
import { useKycTier } from "@/hooks/use-kyc-tier";
import { ASSET_TOKENS } from "@/lib/contracts";
import type { AssetSymbol } from "@/hooks/use-asset-quotes";
import type { SipPlan } from "@/hooks/use-sip-plans";

const VerifyIdentityModal = dynamic(
  () => import("@/components/dashboard/verify-identity-modal").then((m) => m.VerifyIdentityModal),
  { ssr: false }
);

const MARKET_META: Record<AssetSymbol, { name: string }> = {
  sAAPL: { name: "Apple Inc." },
  sTSLA: { name: "Tesla Inc." },
  sNVDA: { name: "NVIDIA Corp." },
  sSPY: { name: "S&P 500 ETF" },
  sAMZN: { name: "Amazon.com Inc." },
  sMSFT: { name: "Microsoft Corp." },
  sMETA: { name: "Meta Platforms" },
  sNFLX: { name: "Netflix Inc." },
  sAMD: { name: "Advanced Micro Devices" },
};

const ASSETS: AssetSymbol[] = [
  "sAAPL",
  "sTSLA",
  "sNVDA",
  "sSPY",
  "sAMZN",
  "sMSFT",
  "sMETA",
  "sNFLX",
  "sAMD",
];

export default function SipPage() {
  const { isConnected } = useAccount();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [runningSipPlanId, setRunningSipPlanId] = useState<string | null>(null);

  const kyc = useKycTier();
  const { isVerified, tier } = kyc;

  const prices = useAssetQuotes();
  const vault = useVault();
  const {
    plans: sipPlanList,
    isLoaded: isSipLoaded,
    createPlan,
    deletePlan,
    togglePlan,
    markPlanExecuted,
  } = useSipPlans();
  const sipAssets = ASSETS.map((sym) => ({ symbol: sym, name: MARKET_META[sym].name }));

  const sipOpenPositions = useMemo(
    () =>
      vault.positions.map((position) => {
        const livePrice = prices[position.asset]?.price ?? 0;
        const markPrice = livePrice > 0 ? livePrice : position.entryPrice;
        const posSizeUSD = position.collateralUSDC * position.leverage;
        const pnl = position.isLong
          ? posSizeUSD * ((markPrice - position.entryPrice) / position.entryPrice)
          : posSizeUSD * ((position.entryPrice - markPrice) / position.entryPrice);

        return {
          asset: position.asset,
          direction: position.direction,
          pnl,
          size: posSizeUSD,
        };
      }),
    [vault.positions, prices]
  );

  const executeSipPlan = useCallback(
    async (plan: SipPlan, source: "manual" | "auto") => {
      if (!isConnected) {
        if (source === "manual") {
          toast.error("Connect wallet to run SIP plans.");
        }
        return;
      }

      if (!isVerified) {
        if (source === "manual") {
          setVerifyModalOpen(true);
          toast.error("Verify identity before running SIP plans.");
        }
        return;
      }

      if (!ASSET_TOKENS[plan.asset]) {
        if (source === "manual") {
          toast.error(`Trading for ${plan.asset} is not enabled yet.`);
        }
        return;
      }

      const executionPrice = prices[plan.asset]?.price ?? 0;
      if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
        if (source === "manual") {
          toast.error(`Live price unavailable for ${plan.asset}.`);
        }
        return;
      }

      if (runningSipPlanId) {
        return;
      }

      setRunningSipPlanId(plan.id);
      try {
        const ok = await vault.openPosition(
          plan.asset,
          "LONG",
          plan.collateralUSDC,
          1,
          executionPrice
        );

        if (ok) {
          markPlanExecuted(plan.id);
          toast.success(
            `${source === "auto" ? "Auto SIP executed" : "SIP executed"}: DCA ${plan.asset} $${plan.collateralUSDC.toFixed(2)}`
          );
        } else if (source === "manual") {
          toast.error("SIP execution failed.");
        }
      } finally {
        setRunningSipPlanId(null);
      }
    },
    [isConnected, isVerified, markPlanExecuted, prices, runningSipPlanId, vault]
  );

  const handleRunSipPlanNow = useCallback(
    async (id: string) => {
      const plan = sipPlanList.find((p) => p.id === id);
      if (!plan) return;
      await executeSipPlan(plan, "manual");
    },
    [sipPlanList, executeSipPlan]
  );

  useEffect(() => {
    if (!isSipLoaded || !isConnected || !isVerified || runningSipPlanId) {
      return;
    }

    let cancelled = false;

    const runDuePlans = async () => {
      if (cancelled) return;
      if (["approving-usdc", "wrapping", "setting-operator", "opening", "closing"].includes(vault.txStatus)) {
        return;
      }

      const now = new Date().getTime();
      const nextPlan = sipPlanList
        .filter((plan) => plan.isActive && new Date(plan.nextRunAt).getTime() <= now)
        .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0];
      if (!nextPlan) return;
      await executeSipPlan(nextPlan, "auto");
    };

    void runDuePlans();
    const intervalId = window.setInterval(() => {
      void runDuePlans();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isSipLoaded, isConnected, isVerified, runningSipPlanId, sipPlanList, executeSipPlan, vault.txStatus]);

  return (
    <div className="min-h-screen bg-background pt-16">
      <AppNav
        onVerifyClick={() => setVerifyModalOpen(true)}
        isVerified={isVerified}
        tier={tier}
        usdcBalance={vault.usdcBalance}
      />

      <div className="border-b border-foreground/10 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-mono mb-1">SIP Plans</h1>
              <p className="text-xs font-mono text-muted-foreground">
                DCA mode only: long exposure, fixed 1x leverage
              </p>
            </div>
            <Link
              href="/trade"
              className="px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 transition-colors"
            >
              Open Manual Trade
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <PortfolioSipSection
          plans={sipPlanList}
          plansLoaded={isSipLoaded}
          prices={prices}
          openPositions={sipOpenPositions}
        />

        <div className="border border-foreground/10">
          <SipPlannerPanel
            selectedAsset="sAAPL"
            assets={sipAssets}
            prices={prices}
            isConnected={isConnected}
            isVerified={isVerified}
            usdcBalance={vault.usdcBalance}
            plans={sipPlanList}
            runningPlanId={runningSipPlanId}
            onVerifyClick={() => setVerifyModalOpen(true)}
            onCreatePlan={(plan) => {
              createPlan(plan);
              toast.success(`Created ${plan.frequency.toLowerCase()} DCA plan for ${plan.asset}.`);
            }}
            onDeletePlan={(id) => {
              deletePlan(id);
              toast.success("SIP plan deleted.");
            }}
            onTogglePlan={togglePlan}
            onRunPlanNow={handleRunSipPlanNow}
          />
        </div>
      </div>

      {verifyModalOpen && (
        <VerifyIdentityModal
          open={verifyModalOpen}
          onOpenChange={setVerifyModalOpen}
        />
      )}
    </div>
  );
}

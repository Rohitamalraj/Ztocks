"use client";

import { useEffect, useMemo, useState } from "react";
import { TokenLogo } from "@/components/ui/token-logo";
import type { AssetSymbol, PriceData } from "@/hooks/use-mock-prices";
import type { SipPlan } from "@/hooks/use-sip-plans";

interface SipOpenPosition {
  asset: AssetSymbol;
  direction: "LONG" | "SHORT";
  pnl: number;
  size: number;
}

interface PortfolioSipSectionProps {
  plans: SipPlan[];
  plansLoaded: boolean;
  prices: Record<AssetSymbol, PriceData>;
  openPositions: SipOpenPosition[];
}

const RUNS_PER_MONTH: Record<SipPlan["frequency"], number> = {
  DAILY: 30,
  WEEKLY: 52 / 12,
  MONTHLY: 1,
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cleanTicker(symbol: AssetSymbol): string {
  return symbol.startsWith("s") ? symbol.slice(1) : symbol;
}

function formatSpotPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "N/A";
  if (value >= 100) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

function formatCountdown(targetIso: string, nowMs: number): string {
  if (!nowMs) return "Syncing...";

  const targetMs = new Date(targetIso).getTime();
  if (!Number.isFinite(targetMs)) return "Invalid date";

  const diff = targetMs - nowMs;
  if (diff <= 0) return "Due now";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function PortfolioSipSection({ plans, plansLoaded, prices, openPositions }: PortfolioSipSectionProps) {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const summary = useMemo(() => {
    const activePlans = plans.filter((p) => p.isActive);
    const totalRuns = plans.reduce((sum, plan) => sum + plan.runCount, 0);
    const deployedUSDC = plans.reduce((sum, plan) => sum + plan.runCount * plan.collateralUSDC, 0);
    const monthlyContribution = activePlans.reduce(
      (sum, plan) => sum + plan.collateralUSDC * RUNS_PER_MONTH[plan.frequency],
      0
    );

    const trackedKeys = new Set(plans.map((p) => `${p.asset}:${p.direction}`));
    const sipOpenPositions = openPositions.filter((position) =>
      trackedKeys.has(`${position.asset}:${position.direction}`)
    );
    const openSipPnl = sipOpenPositions.reduce((sum, position) => sum + position.pnl, 0);
    const openSipNotional = sipOpenPositions.reduce((sum, position) => sum + position.size, 0);

    const nextRun = activePlans
      .map((plan) => new Date(plan.nextRunAt).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b)[0];

    return {
      activeCount: activePlans.length,
      totalCount: plans.length,
      totalRuns,
      deployedUSDC,
      monthlyContribution,
      openSipPnl,
      openSipNotional,
      nextRunMs: nextRun,
    };
  }, [plans, openPositions]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()),
    [plans]
  );

  return (
    <div className="border border-foreground/10 mb-8">
      <div className="p-4 border-b border-foreground/10 bg-foreground/[0.02] flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm">SIP Portfolio</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            Recurring plan performance and upcoming executions
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-muted-foreground">Next Plan Run</div>
          <div className="font-mono text-xs">
            {summary.nextRunMs ? formatCountdown(new Date(summary.nextRunMs).toISOString(), nowMs) : "No active plan"}
          </div>
        </div>
      </div>

      {!plansLoaded ? (
        <div className="p-6 font-mono text-xs text-muted-foreground">Loading SIP plans...</div>
      ) : plans.length === 0 ? (
        <div className="p-6 font-mono text-xs text-muted-foreground">
          No SIP plans found. Create one from the SIP page.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-foreground/10">
            <div className="bg-background p-4">
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Active Plans</div>
              <div className="font-mono text-xl">{summary.activeCount}</div>
              <div className="font-mono text-[10px] text-muted-foreground">of {summary.totalCount}</div>
            </div>

            <div className="bg-background p-4">
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Runs Executed</div>
              <div className="font-mono text-xl">{summary.totalRuns}</div>
              <div className="font-mono text-[10px] text-muted-foreground">historical</div>
            </div>

            <div className="bg-background p-4">
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Deployed Capital</div>
              <div className="font-mono text-xl">{formatCurrency(summary.deployedUSDC)}</div>
              <div className="font-mono text-[10px] text-muted-foreground">estimated from runs</div>
            </div>

            <div className="bg-background p-4">
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Monthly Contribution</div>
              <div className="font-mono text-xl">{formatCurrency(summary.monthlyContribution)}</div>
              <div className="font-mono text-[10px] text-muted-foreground">active plans</div>
            </div>

            <div className="bg-background p-4">
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Open SIP P&L</div>
              <div className={`font-mono text-xl ${summary.openSipPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
                {summary.openSipPnl >= 0 ? "+" : ""}{formatCurrency(summary.openSipPnl).replace("$", "$")}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                on {formatCurrency(summary.openSipNotional)} notional
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-9 gap-4 p-4 border-t border-foreground/10 bg-foreground/[0.02]">
                {[
                  "Plan",
                  "Spot",
                  "Per Run",
                  "Frequency",
                  "Runs",
                  "Next Run",
                  "Countdown",
                  "24h Move",
                  "Status",
                ].map((header) => (
                  <div key={header} className="text-[10px] font-mono text-muted-foreground uppercase">
                    {header}
                  </div>
                ))}
              </div>

              {sortedPlans.map((plan) => {
                const spot = prices[plan.asset]?.price ?? 0;
                const move24h = prices[plan.asset]?.changePercent ?? 0;
                return (
                  <div key={plan.id} className="grid grid-cols-9 gap-4 p-4 border-t border-foreground/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <TokenLogo ticker={plan.asset} size="sm" />
                        <div>
                          <div className="font-mono text-xs">{cleanTicker(plan.asset)}/USD</div>
                          <div className="font-mono text-[10px] text-green-700">DCA 1x</div>
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-xs">{formatSpotPrice(spot)}</div>
                    <div className="font-mono text-xs">{formatCurrency(plan.collateralUSDC)}</div>
                    <div className="font-mono text-xs">{plan.frequency.toLowerCase()}</div>
                    <div className="font-mono text-xs">{plan.runCount}</div>
                    <div className="font-mono text-xs">{new Date(plan.nextRunAt).toLocaleString()}</div>
                    <div className="font-mono text-xs">{formatCountdown(plan.nextRunAt, nowMs)}</div>
                    <div className={`font-mono text-xs ${move24h >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {move24h >= 0 ? "+" : ""}{move24h.toFixed(2)}%
                    </div>
                    <div>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 ${
                          plan.isActive
                            ? "bg-green-700/10 text-green-700"
                            : "bg-foreground/10 text-foreground/70"
                        }`}
                      >
                        {plan.isActive ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

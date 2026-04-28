"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ShieldCheck, ShieldAlert, Loader2, Menu, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useZkIdentity, tierLabel } from "@/hooks/use-zk-identity";
import { VerifyIdentityModal } from "@/components/dashboard/verify-identity-modal";

export type TierKey = "BASIC" | "ADVANCED" | "PREMIUM" | "ULTIMATE";

export const TIERS: Record<TierKey, { label: string; cap: number; shortLabel: string }> = {
  BASIC:    { label: "Basic KYC",          cap: 2,  shortLabel: "T1" },
  ADVANCED: { label: "Accredited Investor", cap: 5,  shortLabel: "T2" },
  PREMIUM:  { label: "Premium HNW",         cap: 8,  shortLabel: "T3" },
  ULTIMATE: { label: "Institutional QIB",   cap: 10, shortLabel: "T4" },
};

interface DashboardNavProps {
  currentTier: TierKey;
  onTierChange: (tier: TierKey) => void;
  showTierMenu: boolean;
  onToggleTierMenu: () => void;
}

export function DashboardNav({ currentTier, onTierChange, showTierMenu, onToggleTierMenu }: DashboardNavProps) {
  const { isConnected } = useAccount();
  const { status, tier, leverageCap } = useZkIdentity();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const demoTier = TIERS[currentTier];
  const zkVerified = status === "verified";
  const zkLoading  = status === "initializing" || status === "submitting";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-b border-foreground/10 h-[72px]">
        <div className="max-w-[1920px] mx-auto px-6 h-full flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2">
              <span className="font-display text-2xl tracking-tight">zkSynth</span>
              <span className="text-muted-foreground font-mono text-xs mt-1">ACCESS</span>
            </a>
            
            {/* Mobile Hamburger */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-muted/50 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Center: Navigation Pills */}
          <div className="hidden md:flex items-center gap-2 border border-foreground/10 px-2 py-1.5">
            <button className="px-6 py-2 bg-foreground text-background font-mono text-xs transition-all hover:bg-foreground/90">
              Perpetuals
            </button>
            <button className="px-6 py-2 text-muted-foreground font-mono text-xs transition-all hover:bg-foreground/[0.02]">
              Portfolio
            </button>
          </div>

          {/* Right: Actions */}

          <div className="flex items-center gap-3">
            {/* KYC Tier Badge */}
            {isConnected && zkVerified && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 border border-foreground/10">
                <ShieldCheck className="w-4 h-4" style={{ color: tier === 1 ? '#15803d' : tier === 2 ? '#1e40af' : tier === 3 ? '#7e22ce' : '#ca8a04' }} />
                <span className="font-mono text-xs">{tierLabel(tier)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">≤{leverageCap}x</span>
              </div>
            )}

            {/* Verify Identity button */}
            {isConnected && !zkVerified && (
              <button
                onClick={() => setVerifyOpen(true)}
                disabled={zkLoading}
                className="hidden md:flex items-center gap-2 px-4 py-2 border border-yellow-600/30 bg-yellow-600/5 hover:border-yellow-600/50 transition-all"
              >
                {zkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-yellow-600" />
                )}
                <span className="text-yellow-600 font-mono text-xs">Verify Identity</span>
              </button>
            )}

            {/* Wallet connect */}
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-[72px] left-0 right-0 bg-background/90 backdrop-blur-xl border-b border-foreground/10 p-4 animate-slide-in">
            <div className="flex flex-col gap-3">
              <button className="w-full px-6 py-3 bg-foreground text-background font-mono text-xs text-left">
                Perpetuals
              </button>
              <button className="w-full px-6 py-3 text-muted-foreground font-mono text-xs text-left hover:bg-foreground/[0.02]">
                Portfolio
              </button>
              
              {isConnected && zkVerified && (
                <div className="flex items-center gap-2 px-4 py-3 border border-foreground/10 mt-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: tier === 1 ? '#15803d' : tier === 2 ? '#1e40af' : tier === 3 ? '#7e22ce' : '#ca8a04' }} />
                  <span className="font-mono text-xs">{tierLabel(tier)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">≤{leverageCap}x</span>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <VerifyIdentityModal open={verifyOpen} onOpenChange={setVerifyOpen} />
    </>
  );
}

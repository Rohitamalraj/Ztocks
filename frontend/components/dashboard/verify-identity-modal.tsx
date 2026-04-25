"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Check,
  AlertCircle,
  RefreshCw,
  Cpu,
  ServerCrash,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useZkIdentity, ZkStatus, tierLabel, tierLeverageCap } from "@/hooks/use-zk-identity";

type IdentityState = Pick<
  ReturnType<typeof useZkIdentity>,
  "status" | "tier" | "expiry" | "error" | "isVerified" | "leverageCap" | "startVerification"
>

interface VerifyIdentityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identityState?: IdentityState;
}

interface ScorePreview {
  tier: number;
  creditScore: number;
  scoreBreakdown?: {
    txCount?: number;
    nativeBalanceEth?: number;
    nativeBalanceHsk?: number;
    usdcBalance?: number;
    txScore?: number;
    balanceScore?: number;
    usdcScore?: number;
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: "oracle",  label: "Compute Score", statuses: ["fetching"]   as ZkStatus[] },
  { id: "prove",   label: "Generate Proof", statuses: ["proving"]    as ZkStatus[] },
  { id: "chain",   label: "On-Chain",       statuses: ["submitting"] as ZkStatus[] },
  { id: "done",    label: "Verified",       statuses: ["verified"]   as ZkStatus[] },
];

const VERIFICATION_CHECKS = [
  "Wallet ownership is bound to this proof (proof cannot be reused by another wallet).",
  "Oracle computes a wallet credit score from tx count, native ETH balance, and USDC collateral balance.",
  "Tier + expiry are signed by the oracle, then proven with Groth16 in your browser.",
  "Only tier and expiry are stored on-chain. Personal data is not stored on-chain.",
];

const ELIGIBILITY_RULES = [
  {
    tier: 4,
    label: "Institutional",
    leverage: 10,
    eligibility: "Credit score 80-100",
  },
  {
    tier: 3,
    label: "Premium HNW",
    leverage: 8,
    eligibility: "Credit score 60-79",
  },
  {
    tier: 2,
    label: "Accredited Investor",
    leverage: 5,
    eligibility: "Credit score 35-59",
  },
  {
    tier: 1,
    label: "Basic",
    leverage: 2,
    eligibility: "Credit score 0-34",
  },
] as const;

function StepIndicator({ status }: { status: ZkStatus }) {
  const activeIdx = STEPS.findIndex((s) => s.statuses.includes(status));
  return (
    <div className="flex items-center justify-between w-full px-2 mb-6">
      {STEPS.map((step, i) => {
        const done    = activeIdx > i || status === "verified";
        const active  = activeIdx === i;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done   ? "bg-emerald-500 text-white" :
                active ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                         "bg-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${done ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function VerifyIdentityModal({ open, onOpenChange, identityState }: VerifyIdentityModalProps) {
  const { address } = useAccount();
  const localIdentity = useZkIdentity();
  const identity = identityState ?? localIdentity;

  const [scorePreview, setScorePreview] = useState<ScorePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const {
    status, tier, expiry, error,
    isVerified, leverageCap,
    startVerification,
  } = identity;

  const expiryDate = expiry ? new Date(expiry * 1000).toLocaleDateString() : null;
  const isRunning  = ["fetching", "proving", "submitting"].includes(status);

  useEffect(() => {
    let cancelled = false;

    async function loadScorePreview() {
      if (!open || !address || isRunning || isVerified) return;

      setPreviewLoading(true);
      setPreviewError(null);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

      try {
        const backendRes = await fetch(`${backendUrl}/api/kyc/${address}`, {
          method: "GET",
          cache: "no-store",
        });

        if (backendRes.ok) {
          const payload = (await backendRes.json()) as ScorePreview;
          if (!cancelled) setScorePreview(payload);
          return;
        }

        throw new Error(`Backend route failed (${backendRes.status})`);
      } catch (err) {
        try {
          const fallbackRes = await fetch(`/api/kyc/${address}`, {
            method: "GET",
            cache: "no-store",
          });
          if (!fallbackRes.ok) {
            throw new Error(`Fallback route failed (${fallbackRes.status})`);
          }
          const payload = (await fallbackRes.json()) as ScorePreview;
          if (!cancelled) setScorePreview(payload);
        } catch (fallbackErr) {
          if (!cancelled) {
            setPreviewError("Unable to load score preview right now.");
          }
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadScorePreview();

    return () => {
      cancelled = true;
    };
  }, [address, open, isRunning, isVerified]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            ZK Identity Verification
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Compute wallet credit score, prove your tier with Groth16, then unlock tier-based leverage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">

          {/* ── Already verified ────────────────────────────────────── */}
          {isVerified && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">Identity Verified</p>
                <p className="text-sm text-muted-foreground">{tierLabel(tier)} · Up to {leverageCap}x leverage</p>
                {expiryDate && <p className="text-xs text-muted-foreground">Expires {expiryDate}</p>}
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                  T{tier} · {tierLabel(tier)}
                </Badge>
                <Badge variant="outline" className="text-primary border-primary/30">≤{leverageCap}x</Badge>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={startVerification}>
                <RefreshCw className="w-3 h-3" /> Refresh Verification
              </Button>
            </div>
          )}

          {/* ── Expired ─────────────────────────────────────────────── */}
          {status === "expired" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-yellow-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Proof Expired</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your ZK proof expired on {expiryDate}. Re-verify to continue trading.
                </p>
              </div>
              <Button onClick={startVerification} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Re-verify Identity
              </Button>
            </div>
          )}

          {/* ── Error ───────────────────────────────────────────────── */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <ServerCrash className="w-7 h-7 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-destructive">Verification Failed</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs break-words">{error}</p>
              </div>
              <Button onClick={startVerification} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try Again
              </Button>
            </div>
          )}

          {/* ── Idle / Start ────────────────────────────────────────── */}
          {status === "idle" && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="w-full rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-foreground mb-2">What We Verify</p>
                <div className="space-y-2">
                  {VERIFICATION_CHECKS.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 text-primary" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">Tier Eligibility</p>
                  <p className="text-[10px] text-muted-foreground">Score -&gt; leverage</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Credit Score = 60% tx activity + 20% native ETH balance + 20% USDC collateral
                </p>
                <div className="space-y-1.5">
                  {ELIGIBILITY_RULES.map((rule) => (
                    <div key={rule.tier} className="rounded-md border border-border px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            T{rule.tier}
                          </Badge>
                          <span className="text-xs font-medium text-foreground">{rule.label}</span>
                        </div>
                        <span className="text-xs font-mono text-primary">≤{rule.leverage}x</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{rule.eligibility}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Your final tier is written on-chain only after successful proof verification.
                </p>

                <div className="rounded-md border border-border mt-2 px-2 py-2 bg-muted/20">
                  {previewLoading && (
                    <p className="text-[11px] text-muted-foreground">Loading wallet score preview...</p>
                  )}

                  {!previewLoading && scorePreview && (
                    <>
                      <p className="text-[11px] font-medium text-foreground">
                        Current wallet preview: Score {scorePreview.creditScore}/100 -&gt; T{scorePreview.tier} (≤{tierLeverageCap(scorePreview.tier)}x)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Tx count: {scorePreview.scoreBreakdown?.txCount ?? 0} | Native balance: {scorePreview.scoreBreakdown?.nativeBalanceEth ?? scorePreview.scoreBreakdown?.nativeBalanceHsk ?? 0} ETH | USDC: {scorePreview.scoreBreakdown?.usdcBalance ?? 0}
                      </p>
                    </>
                  )}

                  {!previewLoading && previewError && (
                    <p className="text-[11px] text-yellow-600">{previewError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full text-xs">
                {([1, 2, 3, 4] as const).map((t) => (
                  <div key={t} className="rounded-lg border border-border p-2 text-center bg-muted/20">
                    <div className="font-semibold text-foreground">T{t}</div>
                    <div className="text-muted-foreground">{tierLabel(t)}</div>
                    <div className="text-primary font-mono">≤{tierLeverageCap(t)}x</div>
                  </div>
                ))}
              </div>
              <Button onClick={startVerification} className="w-full gap-2">
                <Cpu className="w-4 h-4" /> Start ZK Verification
              </Button>
            </div>
          )}

          {/* ── Running (fetching / proving / submitting) ─────────────── */}
          {isRunning && (
            <div className="flex flex-col items-center gap-4 py-4">
              <StepIndicator status={status} />
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                {status === "proving"
                  ? <Cpu className="w-7 h-7 text-primary animate-pulse" />
                  : <Loader2 className="w-7 h-7 text-primary animate-spin" />
                }
              </div>
              <div className="text-center">
                <p className="font-semibold">
                  {status === "fetching"   && "Computing Credit Score & Requesting Credential…"}
                  {status === "proving"    && "Generating Groth16 Proof…"}
                  {status === "submitting" && "Submitting On-Chain…"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {status === "fetching"   && "Oracle reads tx count, native balance, and USDC collateral, computes score, then signs your tier credential."}
                  {status === "proving"    && "snarkjs is computing the ZK proof in your browser. This takes ~10s."}
                  {status === "submitting" && "Sending ZKVerifier.submitProof() to Sepolia."}
                </p>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

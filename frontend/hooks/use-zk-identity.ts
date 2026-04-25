"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { CONTRACTS } from "@/lib/contracts";
import { ZK_VERIFIER_ABI } from "@/lib/abis";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZkStatus =
  | "idle"
  | "fetching"    // Calling oracle to get signed credential
  | "proving"     // snarkjs generating Groth16 proof locally
  | "submitting"  // Sending proof tx to ZKVerifier on-chain
  | "verified"    // Successfully verified on-chain
  | "expired"     // Proof has expired (>30 days)
  | "error";

export type TierKey = "BASIC" | "ADVANCED" | "PREMIUM" | "ULTIMATE";

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, string> = {
  1: "Basic",
  2: "Accredited Investor",
  3: "Premium HNW",
  4: "Institutional",
};

const TIER_LEVERAGE: Record<number, number> = {
  0: 0,
  1: 2,
  2: 5,
  3: 8,
  4: 10,
};

const TIER_KEYS: Record<number, TierKey> = {
  1: "BASIC",
  2: "ADVANCED",
  3: "PREMIUM",
  4: "ULTIMATE",
};

export function tierLabel(tier: number)       { return TIER_LABELS[tier]  ?? "Unverified"; }
export function tierLeverageCap(tier: number) { return TIER_LEVERAGE[tier] ?? 0; }
export function tierKey(tier: number): TierKey { return TIER_KEYS[tier] ?? "BASIC"; }

// ─── Oracle credential ────────────────────────────────────────────────────────

interface OracleCredential {
  address: string;
  tier: number;
  creditScore: number;
  expiry: string;
  nonce: string;
  sigR8x: string;
  sigR8y: string;
  sigS: string;
  pubKeyAx: string;
  pubKeyAy: string;
}

type ProofServerLogLevel = "info" | "error";

interface ProofServerLogOptions {
  level?: ProofServerLogLevel;
  wallet?: string;
  txHash?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useZkIdentity() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [status, setStatus] = useState<ZkStatus>("idle");
  const [tier, setTier]     = useState(0);
  const [expiry, setExpiry] = useState(0);
  const [error, setError]   = useState<string | null>(null);

  // ── Load existing tier on mount ──────────────────────────────────────────
  useEffect(() => { if (address) refreshTier(); }, [address]); // eslint-disable-line

  // ── Full verification flow ───────────────────────────────────────────────
  const startVerification = useCallback(async () => {
    if (!address) { toast.error("Connect your wallet first"); return; }
    setError(null);
    const verificationStartedAt = Date.now();
    console.group(`%c[zkSynth:identity] startVerification`, "color:#a78bfa;font-weight:bold");
    console.log("Wallet:", address);
    void logProofStageToServer("verification-start", { wallet: address });

    try {
      // Step 1: ask oracle to sign a credential for this wallet
      setStatus("fetching");
      console.log("[1/3] Fetching oracle credential...");
      void logProofStageToServer("credential-fetch-start", { wallet: address });
      const cred = await fetchCredential(address);
      console.log("[1/3] ✓ Oracle credential received:", { tier: cred.tier, expiry: new Date(Number(cred.expiry) * 1000).toISOString(), nonce: cred.nonce.slice(0, 10) + "..." });
      void logProofStageToServer("credential-fetch-complete", {
        wallet: address,
        details: {
          tier: cred.tier,
          expiry: cred.expiry,
        },
      });

      // Step 2: generate Groth16 proof locally in the browser
      setStatus("proving");
      console.log("[2/3] Generating Groth16 proof locally (snarkjs)...");
      void logProofStageToServer("proof-generation-start", { wallet: address });
      const proofStartedAt = Date.now();
      console.time("[zkSynth:identity] proof generation");
      toast.loading("Generating ZK proof… (~10s)", { id: "zk" });
      const { a, b, c, pubSignals } = await generateProof(cred, (stage, details) => {
        void logProofStageToServer(stage, {
          wallet: address,
          details,
        });
      });
      console.timeEnd("[zkSynth:identity] proof generation");
      console.log("[2/3] ✓ Proof generated:", { a, b, c, pubSignals });
      void logProofStageToServer("proof-generation-complete", {
        wallet: address,
        durationMs: Date.now() - proofStartedAt,
        details: {
          publicSignals: pubSignals.map((signal) => signal.toString()),
        },
      });

      // Step 3: submit proof on-chain
      setStatus("submitting");
      console.log("[3/3] Submitting proof to ZKVerifier:", CONTRACTS.ZKVerifier);
      void logProofStageToServer("proof-submit-start", {
        wallet: address,
        details: {
          verifier: CONTRACTS.ZKVerifier,
        },
      });
      toast.loading("Submitting proof on-chain…", { id: "zk" });

      const hash = await writeContractAsync({
        address: CONTRACTS.ZKVerifier as `0x${string}`,
        abi: ZK_VERIFIER_ABI,
        functionName: "submitProof",
        args: [a, b, c, pubSignals],
      });

      console.log("[3/3] Tx submitted:", hash);
      void logProofStageToServer("proof-submit-pending", {
        wallet: address,
        txHash: hash,
      });
      toast.loading("Confirming transaction…", { id: "zk" });

      // Wait for receipt
      const receipt = await waitForTx(hash);
      console.log("[3/3] ✓ Tx confirmed:", { hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() });
      void logProofStageToServer("proof-submit-confirmed", {
        wallet: address,
        txHash: hash,
        details: {
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
        },
      });

      toast.success("Identity verified!", {
        id: "zk",
        description: "Your ZK proof is on-chain. You can now trade.",
      });

      await refreshTier();
      void logProofStageToServer("verification-complete", {
        wallet: address,
        durationMs: Date.now() - verificationStartedAt,
      });
      console.groupEnd();
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
      console.error("[zkSynth:identity] ✗ Error:", err);
      void logProofStageToServer("verification-error", {
        level: "error",
        wallet: address,
        durationMs: Date.now() - verificationStartedAt,
        details: {
          message: msg,
          stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
        },
      });
      console.groupEnd();
      setError(msg);
      setStatus("error");
      toast.error("Verification failed", { id: "zk", description: msg });
    }
  }, [address, writeContractAsync]);

  // ── Read tier from ZKVerifier ────────────────────────────────────────────
  const refreshTier = useCallback(async () => {
    if (!address) return;
    console.log("[zkSynth:identity] refreshTier for", address);
    try {
      const { readContract } = await import("@wagmi/core");
      const { wagmiConfig }  = await import("@/lib/wagmi");
      const result = await readContract(wagmiConfig, {
        address: CONTRACTS.ZKVerifier as `0x${string}`,
        abi: ZK_VERIFIER_ABI,
        functionName: "getTier",
        args: [address],
      }) as readonly [number, bigint];

      const t = Number(result[0]);
      const e = Number(result[1]);
      const now = Math.floor(Date.now() / 1000);
      console.log("[zkSynth:identity] On-chain tier:", t, "| expiry:", new Date(e * 1000).toISOString(), "| expired:", now > e);
      setTier(t);
      setExpiry(e);
      if (t > 0 && now <= e)  setStatus("verified");
      else if (t > 0)         setStatus("expired");
      else                    setStatus("idle");
    } catch (err) {
      console.log("[zkSynth:identity] Not yet verified on-chain", err);
    }
  }, [address]);

  const isVerified  = status === "verified";
  const leverageCap = tierLeverageCap(tier);

  return {
    status, tier, expiry, error,
    isVerified, leverageCap,
    startVerification, refreshTier,
    tierLabel: tierLabel(tier),
    tierKey:   tierKey(tier),
  };
}

// ─── Oracle fetch ─────────────────────────────────────────────────────────────

async function fetchCredential(address: string): Promise<OracleCredential> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  const endpoints = [`${backendUrl}/api/kyc/issue`, "/api/kyc/issue"];

  let lastError = "Oracle request failed";

  for (const endpoint of endpoints) {
    try {
      console.log("[zkSynth:oracle] POST", endpoint, "for", address);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: res.statusText }));
        const reason =
          payload && typeof payload.error === "string"
            ? payload.error
            : res.statusText || "Request failed";
        throw new Error(reason);
      }

      const cred = (await res.json()) as OracleCredential;
      console.log("[zkSynth:oracle] ✓ Credential signed — tier:", cred.tier);
      return cred;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn("[zkSynth:oracle] endpoint failed:", endpoint, lastError);
    }
  }

  throw new Error(lastError);
}

// ─── Proof generation ─────────────────────────────────────────────────────────

async function generateProof(
  cred: OracleCredential,
  onStage?: (stage: string, details?: Record<string, unknown>) => void
) {
  onStage?.("proof-load-deps-start");
  console.log("[zkSynth:proof] Loading snarkjs + circomlibjs...");
  const snarkjs = (await import("snarkjs")).default ?? await import("snarkjs");
  const { buildPoseidon } = await import("circomlibjs");
  onStage?.("proof-load-deps-complete");

  const poseidon = await buildPoseidon();
  onStage?.("proof-poseidon-ready");

  const walletAddrBI = BigInt(cred.address);
  const tierBI       = BigInt(cred.tier);
  const creditScoreNum = Number(cred.creditScore);
  if (!Number.isInteger(creditScoreNum) || creditScoreNum < 0 || creditScoreNum > 100) {
    throw new Error("Oracle credential missing valid credit score (expected integer 0-100). Please retry verification.");
  }
  const creditScoreBI = BigInt(creditScoreNum);
  const expiryBI     = BigInt(cred.expiry);
  const nonceBI      = BigInt(cred.nonce);

  // Compute nullifier = Poseidon(nonce, walletAddr) — must match circuit
  const nullRaw  = poseidon([nonceBI, walletAddrBI]);
  const nullifier = poseidon.F.toObject(nullRaw) as bigint;
  onStage?.("proof-nullifier-computed", { nullifier: nullifier.toString() });

  const input = {
    // Private
    walletAddr: walletAddrBI.toString(),
    tier:       tierBI.toString(),
    creditScore: creditScoreBI.toString(),
    expiry:     expiryBI.toString(),
    nonce:      nonceBI.toString(),
    sigR8x:     cred.sigR8x,
    sigR8y:     cred.sigR8y,
    sigS:       cred.sigS,
    // Public
    nullifier:     nullifier.toString(),
    tierPub:       tierBI.toString(),
    expiryPub:     expiryBI.toString(),
    walletAddrPub: walletAddrBI.toString(),
    Ax:            cred.pubKeyAx,
    Ay:            cred.pubKeyAy,
  };

  console.log("[zkSynth:proof] Circuit inputs:", { ...input, sigR8x: "<hidden>", sigR8y: "<hidden>", sigS: "<hidden>" });
  console.log("[zkSynth:proof] Running groth16.fullProve — loading .wasm + .zkey...");
  const fullProveStartedAt = Date.now();
  onStage?.("proof-fullprove-start", {
    wasm: "/circuits/tier_proof.wasm",
    zkey: "/circuits/tier_proof.zkey",
  });
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "/circuits/tier_proof.wasm",
    "/circuits/tier_proof.zkey"
  );
  onStage?.("proof-fullprove-complete", {
    durationMs: Date.now() - fullProveStartedAt,
    publicSignalsCount: publicSignals.length,
  });
  console.log("[zkSynth:proof] ✓ Proof object:", proof);
  console.log("[zkSynth:proof] ✓ Public signals:", publicSignals);

  // Convert to Solidity calldata (hex strings) then to bigint (required by wagmi ABI types)
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parsed   = JSON.parse(`[${calldata}]`) as [string[], string[][], string[], string[]];
  onStage?.("proof-calldata-exported");

  const toBigInt2 = (arr: string[]): [bigint, bigint] =>
    [BigInt(arr[0]), BigInt(arr[1])];
  const toBigInt22 = (arr: string[][]): [[bigint, bigint], [bigint, bigint]] =>
    [[BigInt(arr[0][0]), BigInt(arr[0][1])], [BigInt(arr[1][0]), BigInt(arr[1][1])]];
  const toBigInt6 = (arr: string[]): [bigint, bigint, bigint, bigint, bigint, bigint] =>
    arr.slice(0, 6).map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint];

  onStage?.("proof-arguments-ready", {
    aLength: parsed[0].length,
    bOuterLength: parsed[1].length,
    cLength: parsed[2].length,
    publicSignalsLength: parsed[3].length,
  });

  return {
    a:          toBigInt2(parsed[0]),
    b:          toBigInt22(parsed[1]),
    c:          toBigInt2(parsed[2]),
    pubSignals: toBigInt6(parsed[3]),
  };
}

// ─── Wait for tx ──────────────────────────────────────────────────────────────

async function waitForTx(hash: `0x${string}`) {
  const { waitForTransactionReceipt } = await import("@wagmi/core");
  const { wagmiConfig }               = await import("@/lib/wagmi");
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

async function logProofStageToServer(stage: string, options: ProofServerLogOptions = {}) {
  try {
    await fetch("/api/zk-proof/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({
        stage,
        level: options.level ?? "info",
        wallet: options.wallet,
        txHash: options.txHash,
        durationMs: options.durationMs,
        details: options.details,
      }),
    });
  } catch (err) {
    console.warn("[zkSynth:proof] Failed to send server log", err);
  }
}

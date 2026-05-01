import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProofServerLogLevel = "info" | "error";

interface ProofServerLogPayload {
  stage?: string;
  level?: ProofServerLogLevel;
  wallet?: string;
  txHash?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProofServerLogPayload;
    const stage = body.stage ?? "unknown-stage";
    const level = body.level ?? "info";

    const entry = {
      ts: new Date().toISOString(),
      stage,
      wallet: body.wallet,
      txHash: body.txHash,
      durationMs: body.durationMs,
      details: body.details ?? {},
    };

    if (level === "error") {
      console.error("[Ztocks:proof:server]", entry);
    } else {
      console.log("[Ztocks:proof:server]", entry);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Ztocks:proof:server] Invalid payload", err);
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
}

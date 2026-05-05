import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies fhEVM **public decryption** via Zama Sepolia relayer (see Zama docs).
 * Keeps heavy WASM/tfhe bundles on the Node server instead of the browser webpack graph.
 *
 * POST body: { "handles": ["0x..."] }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { handles?: string[] };
    if (!body.handles?.length) {
      return NextResponse.json({ error: "handles array required" }, { status: 400 });
    }

    const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
    const network =
      process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
      process.env.SEPOLIA_RPC_URL?.trim() ||
      "https://eth-sepolia.g.alchemy.com/v2/XJuG99UM3lVcFxwvSUF7U";

    const instance = await createInstance({
      ...SepoliaConfig,
      network,
    });

    const pd = await instance.publicDecrypt(body.handles as `0x${string}`[]);

    const clearValues: Record<string, string | boolean | string> = {};
    for (const [k, v] of Object.entries(pd.clearValues)) {
      if (typeof v === "bigint") clearValues[k] = v.toString();
      else if (typeof v === "boolean") clearValues[k] = v;
      else clearValues[k] = String(v);
    }

    return NextResponse.json({
      decryptionProof: pd.decryptionProof,
      abiEncodedClearValues: pd.abiEncodedClearValues,
      clearValues,
    });
  } catch (err) {
    console.error("[api/fhe/public-decrypt]", err);
    const message = err instanceof Error ? err.message : "Public decrypt failed";
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}

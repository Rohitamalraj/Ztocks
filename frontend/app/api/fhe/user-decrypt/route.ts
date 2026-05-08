import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, jsonSafe(v)]),
    );
  }
  return value;
}

type Eip712Body = {
  mode: "eip712";
  publicKey: string;
  contractAddresses: `0x${string}`[];
  startTimestamp: number;
  durationDays: number;
};

type KeypairBody = {
  mode: "keypair";
};

type DecryptBody = {
  mode: "decrypt";
  handle: `0x${string}`;
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  privateKey: string;
  publicKey: string;
  signature: `0x${string}`;
  startTimestamp: number;
  durationDays: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Eip712Body | DecryptBody | KeypairBody;
    const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
    const network =
      process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
      process.env.SEPOLIA_RPC_URL?.trim() ||
      "https://eth-sepolia.g.alchemy.com/v2/XJuG99UM3lVcFxwvSUF7U";

    const instance = await createInstance({
      ...SepoliaConfig,
      network,
    });

    if (body.mode === "keypair") {
      const keypair = instance.generateKeypair();
      return NextResponse.json({
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
      });
    }

    if (body.mode === "eip712") {
      const eip712 = instance.createEIP712(
        body.publicKey,
        body.contractAddresses,
        body.startTimestamp,
        body.durationDays,
      );
      return NextResponse.json({ eip712: jsonSafe(eip712) });
    }

    const clearValues = await instance.userDecrypt(
      [{ handle: body.handle, contractAddress: body.contractAddress }],
      body.privateKey,
      body.publicKey,
      body.signature,
      [body.contractAddress],
      body.userAddress,
      body.startTimestamp,
      body.durationDays,
    );
    const byExact = clearValues[body.handle];
    const byLower = clearValues[body.handle.toLowerCase() as `0x${string}`];
    const clearValue = byExact ?? byLower ?? null;

    return NextResponse.json({
      clearValue: typeof clearValue === "bigint" ? clearValue.toString() : clearValue,
    });
  } catch (err) {
    console.error("[api/fhe/user-decrypt]", err);
    const message = err instanceof Error ? err.message : "User decrypt failed";
    return NextResponse.json({ error: message.slice(0, 350) }, { status: 502 });
  }
}

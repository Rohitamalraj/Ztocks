import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EncryptVaultBody = {
  mode: "vault";
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  isLong: boolean;
  collateral: string;
  leverage: number;
  executionPrice: string;
};

type EncryptU64Body = {
  mode: "u64";
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  amount: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EncryptVaultBody | EncryptU64Body;
    if (!body?.contractAddress || !body?.userAddress || !body?.mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    const input = instance.createEncryptedInput(body.contractAddress, body.userAddress);
    if (body.mode === "vault") {
      input.addBool(body.isLong);
      input.add64(BigInt(body.collateral));
      input.add8(body.leverage);
      input.add64(BigInt(body.executionPrice));
    } else {
      input.add64(BigInt(body.amount));
    }

    const encrypted = await input.encrypt();
    const handles = encrypted.handles.map((h) => `0x${Buffer.from(h).toString("hex")}`);
    const inputProof = `0x${Buffer.from(encrypted.inputProof).toString("hex")}`;

    return NextResponse.json({ handles, inputProof });
  } catch (err) {
    console.error("[api/fhe/encrypt-input]", err);
    const message = err instanceof Error ? err.message : "Encryption failed";
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}


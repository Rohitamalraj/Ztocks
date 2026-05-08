"use client";

import type { Hex } from "viem";

type EncryptedInput = {
  handles: Hex[];
  inputProof: Hex;
};

const ENCRYPT_REQUEST_TIMEOUT_MS = 30_000;
const ENCRYPT_REQUEST_RETRIES = 3;

type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    addBool:  (value: boolean) => void;
    add8:     (value: number | bigint) => void;
    add64:    (value: number | bigint) => void;
    encrypt:  () => Promise<EncryptedInput>;
  };
  userDecryptEbool?:   (handle: Hex, contractAddress: string, signer: unknown) => Promise<boolean>;
  userDecryptEuint8?:  (handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  userDecryptEuint64?: (handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  userDecryptEuint?:   (type: unknown, handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  FhevmType?: Record<string, unknown>;
  decrypt?: (contractAddress: string, ciphertext: string) => bigint;
  generatePublicKey?: (options: {
    verifyingContract: string;
    force?: boolean;
  }) => {
    publicKey: Uint8Array;
    eip712: {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    };
  };
  setSignature?: (contractAddress: string, signature: string) => void;
  hasKeypair?: (contractAddress: string) => boolean;
  getPublicKey?: (contractAddress: string) => { signature?: string | null } | null;
};

let instancePromise: Promise<FhevmInstance> | null = null;

/**
 * Initialize fhevmjs with Zama's SepoliaConfig.
 * SepoliaConfig includes:
 *   - Gateway:  https://gateway.sepolia.zama.ai/
 *   - Relayer:  https://relayer.testnet.zama.org
 *   - Chain ID: 11155111
 */
async function getInstance(): Promise<FhevmInstance> {
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    // Step 1: Initialize libsodium WASM (must be ready before fhevmjs)
    try {
      const sodium = await import("libsodium-wrappers");
      await sodium.ready;
    } catch {
      console.warn("[fhe] libsodium-wrappers not available; fhevmjs may use fallback");
    }

    const mod: any = await import("fhevmjs");

    const provider = (globalThis as any).ethereum;
    if (!provider) {
      throw new Error("FHE encryption requires a browser wallet (MetaMask).");
    }

    // Try SepoliaConfig first (new fhevmjs API)
    if (mod.SepoliaConfig && typeof mod.createInstance === "function") {
      const instance = await mod.createInstance({
        ...mod.SepoliaConfig,
        network: provider,
      });
      return instance as FhevmInstance;
    }

    // Fallback: older createInstance API
    if (typeof mod.createInstance === "function") {
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      const chainId    = Number.parseInt(chainIdHex, 16);
      const publicKey  = typeof mod.getPublicKey === "function"
        ? await mod.getPublicKey(provider)
        : undefined;

      const instance = await mod.createInstance({
        chainId,
        publicKey,
        network:    provider,
        gatewayUrl: "https://gateway.sepolia.zama.ai/",
      });
      return instance as FhevmInstance;
    }

    // Module-level API (some build outputs)
    if (mod.fhevm?.createEncryptedInput) return mod.fhevm as FhevmInstance;
    if (mod.default?.createEncryptedInput) return mod.default as FhevmInstance;

    throw new Error("Unsupported fhevmjs API — please update the package.");
  })();

  return instancePromise;
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Build encrypted inputs for openPosition():
 *   encIsLong, encCollateralUSDC, encLeverage, encExecutionPrice
 */
export async function buildEncryptedVaultInputs(params: {
  contractAddress: string;
  userAddress:     string;
  isLong:          boolean;
  collateral:      bigint;
  leverage:        number;
  executionPrice:  bigint;
}): Promise<EncryptedInput> {
  return postEncryptedInput({
    mode: "vault",
    contractAddress: params.contractAddress,
    userAddress: params.userAddress,
    isLong: params.isLong,
    collateral: params.collateral.toString(),
    leverage: params.leverage,
    executionPrice: params.executionPrice.toString(),
  });
}

/** Single `euint64` encrypted input (e.g. cUSDC unwrap amount). */
export async function buildEncryptedEuint64(params: {
  contractAddress: string;
  userAddress:     string;
  amount:          bigint;
}): Promise<EncryptedInput> {
  return postEncryptedInput({
    mode: "u64",
    contractAddress: params.contractAddress,
    userAddress: params.userAddress,
    amount: params.amount.toString(),
  });
}

async function postEncryptedInput(payload: Record<string, unknown>): Promise<EncryptedInput> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= ENCRYPT_REQUEST_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ENCRYPT_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/fhe/encrypt-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      const data = (await res.json()) as { handles?: Hex[]; inputProof?: Hex; error?: string };
      if (!res.ok || !data.handles || !data.inputProof) {
        throw new Error(data.error ?? "Failed to encrypt input");
      }
      return { handles: data.handles, inputProof: data.inputProof };
    } catch (err) {
      lastErr = err;
      if (attempt < ENCRYPT_REQUEST_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    lastErr instanceof Error ? lastErr.message : "Encryption request failed after retries",
  );
}

export async function decryptEbool(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<boolean | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const viaServer = await decryptViaServer(handle, contractAddress, signer);
  if (typeof viaServer === "boolean") return viaServer;
  const api = await getInstance();
  try {
    await ensureDecryptAuth(api, contractAddress, signer);
    if (api.userDecryptEbool) return await api.userDecryptEbool(handle, contractAddress, signer);
    console.warn("[fhe] userDecryptEbool API unavailable on instance");
  } catch (err) {
    console.warn("[fhe] decryptEbool failed", {
      contractAddress,
      handle,
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return null;
  }
  return null;
}

export async function decryptEuint64(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const viaServer = await decryptViaServer(handle, contractAddress, signer);
  if (typeof viaServer === "bigint") return viaServer;
  const api = await getInstance();
  try {
    await ensureDecryptAuth(api, contractAddress, signer);
    if (api.userDecryptEuint64) return await api.userDecryptEuint64(handle, contractAddress, signer);
    if (api.userDecryptEuint && api.FhevmType?.euint64)
      return await api.userDecryptEuint(api.FhevmType.euint64, handle, contractAddress, signer);
    console.warn("[fhe] userDecryptEuint64 API unavailable on instance");
  } catch (err) {
    console.warn("[fhe] decryptEuint64 failed", {
      contractAddress,
      handle,
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return null;
  }
  return null;
}

export async function decryptEuint8(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const viaServer = await decryptViaServer(handle, contractAddress, signer);
  if (typeof viaServer === "bigint") return viaServer;
  const api = await getInstance();
  try {
    await ensureDecryptAuth(api, contractAddress, signer);
    if (api.userDecryptEuint8) return await api.userDecryptEuint8(handle, contractAddress, signer);
    if (api.userDecryptEuint && api.FhevmType?.euint8)
      return await api.userDecryptEuint(api.FhevmType.euint8, handle, contractAddress, signer);
    console.warn("[fhe] userDecryptEuint8 API unavailable on instance");
  } catch (err) {
    console.warn("[fhe] decryptEuint8 failed", {
      contractAddress,
      handle,
      message: err instanceof Error ? err.message : String(err),
      err,
    });
    return null;
  }
  return null;
}

async function decryptViaServer(
  handle: Hex,
  contractAddress: string,
  signer: unknown,
): Promise<bigint | boolean | Hex | null> {
  try {
    const wallet = signer as {
      account?: { address?: `0x${string}` };
      signTypedData?: (args: {
        domain: Record<string, unknown>;
        types: Record<string, Array<{ name: string; type: string }>>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => Promise<Hex>;
    };
    const userAddress = wallet?.account?.address;
    if (!userAddress || !wallet?.signTypedData) return null;

    const cacheKey = `ztocks:user-decrypt:${userAddress.toLowerCase()}:${contractAddress.toLowerCase()}`;
    const now = Math.floor(Date.now() / 1000);
    const durationDays = 30;
    const saved = globalThis.localStorage?.getItem(cacheKey);
    let material: {
      privateKey: string;
      publicKey: string;
      signature: Hex;
      startTimestamp: number;
      durationDays: number;
    } | null = saved ? JSON.parse(saved) : null;

    if (!material?.privateKey || !material?.publicKey) {
      const kpRes = await fetch("/api/fhe/user-decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "keypair" }),
      });
      const kpData = await kpRes.json() as { privateKey?: string; publicKey?: string; error?: string };
      if (!kpRes.ok || !kpData.privateKey || !kpData.publicKey) {
        throw new Error(kpData.error ?? "user-decrypt keypair generation failed");
      }
      material = {
        privateKey: kpData.privateKey,
        publicKey: kpData.publicKey,
        signature: "0x",
        startTimestamp: 0,
        durationDays,
      };
    }

    if (!material || now > material.startTimestamp + material.durationDays * 86400) {
      const startTimestamp = now;
      const eipRes = await fetch("/api/fhe/user-decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "eip712",
          publicKey: material.publicKey,
          contractAddresses: [contractAddress],
          startTimestamp,
          durationDays,
        }),
      });
      const eipData = await eipRes.json() as {
        eip712?: {
          domain: Record<string, unknown>;
          types: Record<string, Array<{ name: string; type: string }>>;
          primaryType: string;
          message: Record<string, unknown>;
        };
        error?: string;
      };
      if (!eipRes.ok || !eipData.eip712) throw new Error(eipData.error ?? "user-decrypt eip712 failed");
      const signingPayload = normalizeTypedDataForViem(
        eipData.eip712.domain,
        eipData.eip712.types,
        eipData.eip712.primaryType,
        eipData.eip712.message,
      );
      const signature = await wallet.signTypedData({
        domain: signingPayload.domain,
        types: signingPayload.types,
        primaryType: signingPayload.primaryType,
        message: signingPayload.message,
      });
      material = {
        privateKey: material.privateKey,
        publicKey: material.publicKey,
        signature,
        startTimestamp,
        durationDays,
      };
      globalThis.localStorage?.setItem(cacheKey, JSON.stringify(material));
    }

    const decRes = await fetch("/api/fhe/user-decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "decrypt",
        handle,
        contractAddress,
        userAddress,
        privateKey: material.privateKey,
        publicKey: material.publicKey,
        signature: material.signature,
        startTimestamp: material.startTimestamp,
        durationDays: material.durationDays,
      }),
    });
    const decData = await decRes.json() as { clearValue?: string | boolean; error?: string };
    if (!decRes.ok) throw new Error(decData.error ?? "user-decrypt failed");
    if (typeof decData.clearValue === "boolean") return decData.clearValue;
    if (typeof decData.clearValue === "string") {
      try { return BigInt(decData.clearValue); } catch { return decData.clearValue as Hex; }
    }
  } catch (err) {
    console.warn("[fhe] userDecrypt(server) failed", {
      contractAddress,
      handle,
      message: err instanceof Error ? err.message : String(err),
      err,
    });
  }
  return null;
}

function normalizeTypedDataForViem(
  domain: Record<string, unknown>,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>,
): {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
} {
  const toTypedValue = (value: unknown, typ: string): unknown => {
    if (value === null || value === undefined) return value;
    if (typ.endsWith("[]") && Array.isArray(value)) {
      const inner = typ.slice(0, -2);
      return value.map((v) => toTypedValue(v, inner));
    }
    if (/^u?int\d*$/.test(typ)) {
      if (typeof value === "bigint") return value;
      if (typeof value === "number") return BigInt(value);
      if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
    }
    return value;
  };

  const normalizedDomain: Record<string, unknown> = { ...domain };
  const domainTypes = types.EIP712Domain ?? [];
  for (const field of domainTypes) {
    normalizedDomain[field.name] = toTypedValue(normalizedDomain[field.name], field.type);
  }

  const normalizedMessage: Record<string, unknown> = { ...message };
  const messageTypes = types[primaryType] ?? [];
  for (const field of messageTypes) {
    normalizedMessage[field.name] = toTypedValue(normalizedMessage[field.name], field.type);
  }

  return { domain: normalizedDomain, types, primaryType, message: normalizedMessage };
}

async function ensureDecryptAuth(
  api: FhevmInstance,
  contractAddress: string,
  signer: unknown,
): Promise<void> {
  if (!api.generatePublicKey || !api.setSignature) return;
  const wallet = signer as {
    signTypedData?: (args: {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => Promise<Hex>;
  };
  if (!wallet?.signTypedData) return;

  const hasPair = api.hasKeypair?.(contractAddress) ?? false;
  const pub = hasPair ? api.getPublicKey?.(contractAddress) ?? null : null;
  const hasSig = !!pub?.signature;
  if (hasPair && hasSig) return;

  const { eip712 } = api.generatePublicKey({ verifyingContract: contractAddress, force: true });
  const eip712Types = { ...eip712.types };
  delete (eip712Types as Record<string, unknown>).EIP712Domain;

  try {
    const signature = await wallet.signTypedData({
      domain: eip712.domain,
      types: eip712Types,
      primaryType: eip712.primaryType,
      message: eip712.message,
    });
    api.setSignature(contractAddress, signature);
  } catch (err) {
    // Fallback for wallet clients expecting the original shape.
    const signature = await wallet.signTypedData({
      domain: eip712.domain,
      types: eip712.types,
      primaryType: eip712.primaryType,
      message: eip712.message,
    });
    api.setSignature(contractAddress, signature);
    console.warn("[fhe] Decrypt auth used fallback typed-data format", err);
  }
}

"use client";

import type { Hex } from "viem";

type EncryptedInput = {
  handles: Hex[];
  inputProof: Hex;
};

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
  const api   = await getInstance();
  const input = api.createEncryptedInput(params.contractAddress, params.userAddress);
  input.addBool(params.isLong);
  input.add64(params.collateral);
  input.add8(params.leverage);
  input.add64(params.executionPrice);
  return input.encrypt();
}

/** Single `euint64` encrypted input (e.g. cUSDC unwrap amount). */
export async function buildEncryptedEuint64(params: {
  contractAddress: string;
  userAddress:     string;
  amount:          bigint;
}): Promise<EncryptedInput> {
  const api   = await getInstance();
  const input = api.createEncryptedInput(params.contractAddress, params.userAddress);
  input.add64(params.amount);
  return input.encrypt();
}

export async function decryptEbool(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<boolean | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await getInstance();
  return api.userDecryptEbool?.(handle, contractAddress, signer) ?? null;
}

export async function decryptEuint64(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await getInstance();
  if (api.userDecryptEuint64) return api.userDecryptEuint64(handle, contractAddress, signer);
  if (api.userDecryptEuint && api.FhevmType?.euint64)
    return api.userDecryptEuint(api.FhevmType.euint64, handle, contractAddress, signer);
  return null;
}

export async function decryptEuint8(
  handle: Hex, contractAddress: string, signer: unknown
): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await getInstance();
  if (api.userDecryptEuint8) return api.userDecryptEuint8(handle, contractAddress, signer);
  if (api.userDecryptEuint && api.FhevmType?.euint8)
    return api.userDecryptEuint(api.FhevmType.euint8, handle, contractAddress, signer);
  return null;
}

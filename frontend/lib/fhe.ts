"use client";

import type { Hex } from "viem";

type EncryptedInput = {
  handles: Hex[];
  inputProof: Hex;
};

type FhevmApi = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    addBool: (value: boolean) => void;
    add8: (value: number | bigint) => void;
    add64: (value: number | bigint) => void;
    encrypt: () => Promise<EncryptedInput>;
  };
  userDecryptEbool?: (handle: Hex, contractAddress: string, signer: unknown) => Promise<boolean>;
  userDecryptEuint?: (type: unknown, handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  userDecryptEuint8?: (handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  userDecryptEuint64?: (handle: Hex, contractAddress: string, signer: unknown) => Promise<bigint>;
  FhevmType?: Record<string, unknown>;
};

let apiPromise: Promise<FhevmApi> | null = null;

async function resolveFhevmApi(): Promise<FhevmApi> {
  if (apiPromise) return apiPromise;

  apiPromise = (async () => {
    const mod: any = await import("fhevmjs");

    if (typeof mod.createInstance === "function") {
      const provider = (globalThis as any).ethereum;
      if (!provider) {
        throw new Error("FHE encryption requires a browser wallet provider.");
      }
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      const chainId = Number.parseInt(chainIdHex, 16);
      const publicKey = typeof mod.getPublicKey === "function" ? await mod.getPublicKey(provider) : undefined;
      const instance = await mod.createInstance({
        chainId,
        publicKey,
        network: provider,
      });
      return instance as FhevmApi;
    }

    if (mod.fhevm?.createEncryptedInput) {
      return mod.fhevm as FhevmApi;
    }

    if (mod.default?.createEncryptedInput) {
      return mod.default as FhevmApi;
    }

    throw new Error("Unsupported fhevmjs API surface.");
  })();

  return apiPromise;
}

export async function buildEncryptedVaultInputs(params: {
  contractAddress: string;
  userAddress: string;
  isLong: boolean;
  collateral: bigint;
  leverage: number;
  executionPrice: bigint;
}): Promise<EncryptedInput> {
  const api = await resolveFhevmApi();
  const input = api.createEncryptedInput(params.contractAddress, params.userAddress);
  input.addBool(params.isLong);
  input.add64(params.collateral);
  input.add8(params.leverage);
  input.add64(params.executionPrice);
  return input.encrypt();
}

export async function decryptEbool(handle: Hex, contractAddress: string, signer: unknown): Promise<boolean | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await resolveFhevmApi();
  if (typeof api.userDecryptEbool === "function") {
    return api.userDecryptEbool(handle, contractAddress, signer);
  }
  return null;
}

export async function decryptEuint64(handle: Hex, contractAddress: string, signer: unknown): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await resolveFhevmApi();
  if (typeof api.userDecryptEuint64 === "function") {
    return api.userDecryptEuint64(handle, contractAddress, signer);
  }
  if (typeof api.userDecryptEuint === "function" && api.FhevmType?.euint64) {
    return api.userDecryptEuint(api.FhevmType.euint64, handle, contractAddress, signer);
  }
  return null;
}

export async function decryptEuint8(handle: Hex, contractAddress: string, signer: unknown): Promise<bigint | null> {
  if (!handle || handle === "0x" + "0".repeat(64)) return null;
  const api = await resolveFhevmApi();
  if (typeof api.userDecryptEuint8 === "function") {
    return api.userDecryptEuint8(handle, contractAddress, signer);
  }
  if (typeof api.userDecryptEuint === "function" && api.FhevmType?.euint8) {
    return api.userDecryptEuint(api.FhevmType.euint8, handle, contractAddress, signer);
  }
  return null;
}

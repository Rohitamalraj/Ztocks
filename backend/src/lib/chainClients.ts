import { createPublicClient, http, fallback, type Chain, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * ChainClientManager
 * Manages public clients for different networks.
 * For Ztocks, we connect to Sepolia with fallback RPCs for reliability.
 */
export class ChainClientManager {
  private clients = new Map<number, PublicClient>();

  constructor() {
    this.getOrCreate(sepolia);
  }

  getOrCreate(chain: Chain): PublicClient {
    const existing = this.clients.get(chain.id);
    if (existing) return existing;

    const primaryRpc = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

    // Use fallback transport with multiple RPCs for reliability
    const transport = fallback([
      http(primaryRpc, { timeout: 8_000, retryCount: 1 }),
      http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 8_000, retryCount: 1 }),
      http('https://rpc2.sepolia.org', { timeout: 8_000, retryCount: 1 }),
      http('https://rpc.sepolia.org', { timeout: 10_000, retryCount: 0 }),
    ]);

    const client = createPublicClient({
      chain,
      transport,
    }) as unknown as PublicClient;

    this.clients.set(chain.id, client);
    console.log(`[chain] Created client for ${chain.name} (${chain.id}) → ${primaryRpc} (+ fallbacks)`);
    return client;
  }

  getSepolia(): PublicClient {
    return this.getOrCreate(sepolia);
  }

  getPrimary(): PublicClient {
    return this.getSepolia();
  }
}

export const chainClients = new ChainClientManager();

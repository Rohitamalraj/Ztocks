import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * ChainClientManager
 * Manages public clients for different networks.
 * For Ztocks, we connect to Sepolia.
 */
export class ChainClientManager {
  private clients = new Map<number, PublicClient>();

  constructor() {
    // Initialize Sepolia client on startup
    this.getOrCreate(sepolia);
  }

  getOrCreate(chain: Chain): PublicClient {
    const existing = this.clients.get(chain.id);
    if (existing) return existing;

    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, {
        timeout: 15_000,
        retryCount: 2,
      }),
    }) as unknown as PublicClient;

    this.clients.set(chain.id, client);
    console.log(`[chain] Created client for ${chain.name} (${chain.id}) → ${rpcUrl}`);
    return client;
  }

  getSepolia(): PublicClient {
    return this.getOrCreate(sepolia);
  }

  // Alias for primary chain
  getPrimary(): PublicClient {
    return this.getSepolia();
  }
}

export const chainClients = new ChainClientManager();

/**
 * POST /api/kyc/issue
 *
 * Frontend fallback KYC oracle endpoint.
 *
 * Determines the caller's tier from Sepolia wallet activity (tx count,
 * native ETH balance, and USDC balance) and signs a Baby Jubjub credential
 * consumed by the Groth16 tier circuit.
 *
 * Signs a credential { walletAddr, tier, expiry, nonce } using the oracle's
 * Baby Jubjub EdDSA private key (compatible with circomlib EdDSAPoseidonVerifier).
 *
 * The frontend uses this credential as private inputs to generate a Groth16 proof.
 */
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, formatEther, formatUnits } from "viem";
import { derivePublicKey, signMessage } from "@zk-kit/eddsa-poseidon";
import { buildPoseidon } from "circomlibjs";
import { sepolia } from "viem/chains";

// ─── Chain config ──────────────────────────────────────────────────────────
const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://rpc.sepolia.org";

const client = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const USDC_TOKEN_ADDRESS = (
  process.env.USDC_ADDRESS ||
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  ZERO_ADDRESS
) as `0x${string}`;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

interface CreditScoreAssessment {
  txCount: number;
  nativeBalanceEth: number;
  usdcBalance: number;
  txScore: number;
  balanceScore: number;
  usdcScore: number;
  creditScore: number;
  tier: number;
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function scoreFromTxCount(txCount: number): number {
  const normalized = Math.log10(txCount + 1) / Math.log10(301);
  return clampScore(normalized * 100);
}

function scoreFromNativeBalance(balanceEth: number): number {
  const normalized = Math.log10(balanceEth + 1) / Math.log10(11);
  return clampScore(normalized * 100);
}

function scoreFromUsdcBalance(usdcBalance: number): number {
  const normalized = Math.log10(usdcBalance + 1) / Math.log10(100001);
  return clampScore(normalized * 100);
}

function tierFromCreditScore(creditScore: number): number {
  if (creditScore >= 80) return 4;
  if (creditScore >= 60) return 3;
  if (creditScore >= 35) return 2;
  return 1;
}

// ─── Tier determination via wallet credit score ───────────────────────────
async function determineTier(address: `0x${string}`): Promise<CreditScoreAssessment> {
  console.log("[Ztocks:oracle] determineTier (credit score) for", address);

  let txCount = 0;
  let nativeBalanceEth = 0;
  let usdcBalance = 0;

  try {
    txCount = await client.getTransactionCount({ address });
  } catch (err) {
    console.warn("[zkSynth:oracle] tx count failed:", err);
  }

  try {
    const nativeBalanceWei = await client.getBalance({ address });
    nativeBalanceEth = Number(formatEther(nativeBalanceWei));
  } catch (err) {
    console.warn("[Ztocks:oracle] native balance read failed:", err);
  }

  if (USDC_TOKEN_ADDRESS.toLowerCase() !== ZERO_ADDRESS) {
    try {
      const [usdcRaw, usdcDecimals] = await Promise.all([
        client.readContract({
          address: USDC_TOKEN_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [address],
        }) as Promise<bigint>,
        client.readContract({
          address: USDC_TOKEN_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: "decimals",
        }) as Promise<number>,
      ]);
      usdcBalance = Number(formatUnits(usdcRaw, usdcDecimals));
    } catch (err) {
      console.warn("[Ztocks:oracle] usdc balance read failed:", err);
    }
  }

  const txScore = scoreFromTxCount(txCount);
  const balanceScore = scoreFromNativeBalance(nativeBalanceEth);
  const usdcScore = scoreFromUsdcBalance(usdcBalance);
  const creditScore = clampScore(txScore * 0.6 + balanceScore * 0.2 + usdcScore * 0.2);
  const tier = tierFromCreditScore(creditScore);

  const result: CreditScoreAssessment = {
    txCount,
    nativeBalanceEth: Number(nativeBalanceEth.toFixed(6)),
    usdcBalance: Number(usdcBalance.toFixed(6)),
    txScore,
    balanceScore,
    usdcScore,
    creditScore,
    tier,
  };

  console.log("[Ztocks:oracle] credit score result", result);
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body as { address: string };

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
    if (!ORACLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Oracle not configured — set ORACLE_PRIVATE_KEY in .env.local" },
        { status: 503 }
      );
    }

    console.log("[Ztocks:oracle] POST /api/kyc/issue — address:", address);
    const scoreAssessment = await determineTier(address as `0x${string}`);
    const tier   = scoreAssessment.tier;
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600); // 30 days
    console.log("[Ztocks:oracle] Signing credential — tier:", tier, "| expiry:", new Date(Number(expiry) * 1000).toISOString());

    // Random 253-bit nonce (stays below BN128 field prime)
    const nonceBytes = new Uint8Array(31);
    crypto.getRandomValues(nonceBytes);
    const nonce = BigInt("0x" + Buffer.from(nonceBytes).toString("hex"));

    // walletAddr as field element (Ethereum address is 160 bits, fits in BN128)
    const walletAddrBI = BigInt(address);

    // Compute message hash: Poseidon(walletAddr, tier, creditScore, expiry, nonce)
    // Must match the circuit's msgHash component exactly.
    const poseidon = await buildPoseidon();
    const msgHashRaw = poseidon([
      walletAddrBI,
      BigInt(tier),
      BigInt(scoreAssessment.creditScore),
      expiry,
      nonce,
    ]);
    const msgHash    = poseidon.F.toObject(msgHashRaw) as bigint;

    // Sign with oracle's Baby Jubjub key (compatible with EdDSAPoseidonVerifier)
    const privKeyBuf = Buffer.from(ORACLE_PRIVATE_KEY, "hex");
    const sig    = signMessage(privKeyBuf, msgHash);
    const pubKey = derivePublicKey(privKeyBuf);

    return NextResponse.json({
      address,
      tier,
      expiry:    expiry.toString(),
      nonce:     nonce.toString(),
      sigR8x:    sig.R8[0].toString(),
      sigR8y:    sig.R8[1].toString(),
      sigS:      sig.S.toString(),
      pubKeyAx:  pubKey[0].toString(),
      pubKeyAy:  pubKey[1].toString(),
      creditScore: scoreAssessment.creditScore,
      scoreBreakdown: {
        txCount: scoreAssessment.txCount,
        nativeBalanceEth: scoreAssessment.nativeBalanceEth,
        usdcBalance: scoreAssessment.usdcBalance,
        txScore: scoreAssessment.txScore,
        balanceScore: scoreAssessment.balanceScore,
        usdcScore: scoreAssessment.usdcScore,
      },
    });
  } catch (err) {
    console.error("[/api/kyc/issue]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

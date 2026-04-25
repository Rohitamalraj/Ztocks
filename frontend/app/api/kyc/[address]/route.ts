import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { sepolia } from "viem/chains";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    let txCount = 0;
    let nativeBalanceEth = 0;
    let usdcBalance = 0;

    try {
      txCount = await client.getTransactionCount({ address: address as `0x${string}` });
    } catch (err) {
      console.warn("[kyc api] tx count read failed", err);
    }

    try {
      const nativeBalanceWei = await client.getBalance({ address: address as `0x${string}` });
      nativeBalanceEth = Number(formatEther(nativeBalanceWei));
    } catch (err) {
      console.warn("[kyc api] native balance read failed", err);
    }

    if (USDC_TOKEN_ADDRESS.toLowerCase() !== ZERO_ADDRESS) {
      try {
        const [usdcRaw, usdcDecimals] = await Promise.all([
          client.readContract({
            address: USDC_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }) as Promise<bigint>,
          client.readContract({
            address: USDC_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: "decimals",
          }) as Promise<number>,
        ]);
        usdcBalance = Number(formatUnits(usdcRaw, usdcDecimals));
      } catch (err) {
        console.warn("[kyc api] usdc balance read failed", err);
      }
    }

    const txScore = scoreFromTxCount(txCount);
    const balanceScore = scoreFromNativeBalance(nativeBalanceEth);
    const usdcScore = scoreFromUsdcBalance(usdcBalance);
    const creditScore = clampScore(txScore * 0.6 + balanceScore * 0.2 + usdcScore * 0.2);
    const tier = tierFromCreditScore(creditScore);

    return NextResponse.json(
      {
        address,
        tier,
        creditScore,
        scoreBreakdown: {
          txCount,
          nativeBalanceEth: Number(nativeBalanceEth.toFixed(6)),
          usdcBalance: Number(usdcBalance.toFixed(6)),
          txScore,
          balanceScore,
          usdcScore,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );
  } catch (err) {
    console.error("[kyc api] error", err);
    return NextResponse.json(
      {
        address,
        tier: 1,
        creditScore: 0,
        scoreBreakdown: {
          txCount: 0,
          nativeBalanceEth: 0,
          usdcBalance: 0,
          txScore: 0,
          balanceScore: 0,
          usdcScore: 0,
        },
      },
      { status: 200 }
    );
  }
}

import { Router, Request, Response } from 'express';
import { isAddress, formatEther, formatUnits } from 'viem';
import { derivePublicKey, signMessage } from '@zk-kit/eddsa-poseidon';
import { buildPoseidon } from 'circomlibjs';
import { chainClients } from '../lib/chainClients';

const router = Router();

const DEFAULT_USDC_ADDRESS = '0x0000000000000000000000000000000000000000';
const USDC_TOKEN_ADDRESS = (process.env.USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || DEFAULT_USDC_ADDRESS) as `0x${string}`;

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
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
  // Log scaling up to ~300 txs to reduce whale/spam distortion.
  const normalized = Math.log10(txCount + 1) / Math.log10(301);
  return clampScore(normalized * 100);
}

function scoreFromNativeBalance(balanceEth: number): number {
  // Log scaling up to ~10 ETH
  const normalized = Math.log10(balanceEth + 1) / Math.log10(11);
  return clampScore(normalized * 100);
}

function scoreFromUsdcBalance(usdcBalance: number): number {
  // Log scaling up to ~100k USDC
  const normalized = Math.log10(usdcBalance + 1) / Math.log10(100001);
  return clampScore(normalized * 100);
}

function tierFromCreditScore(creditScore: number): number {
  if (creditScore >= 80) return 4;
  if (creditScore >= 60) return 3;
  if (creditScore >= 35) return 2;
  return 1;
}

async function assessCreditScore(address: `0x${string}`): Promise<CreditScoreAssessment> {
  console.log('[KYC] Assessing wallet credit score for', address, '(Sepolia)');

  let txCount = 0;
  let nativeBalanceEth = 0;
  let usdcBalance = 0;

  const client = chainClients.getSepolia();
  try {
    txCount = await client.getTransactionCount({ address });
  } catch (err) {
    console.warn('[KYC] tx count read failed:', err);
  }

  try {
    const nativeBalanceWei = await client.getBalance({ address });
    nativeBalanceEth = Number(formatEther(nativeBalanceWei));
  } catch (err) {
    console.warn('[KYC] native balance read failed:', err);
  }

  // Only read USDC balance if an address is configured
  const isZeroAddress = USDC_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000';
  if (!isZeroAddress) {
    try {
      const [usdcRaw, usdcDecimals] = await Promise.all([
        client.readContract({
          address: USDC_TOKEN_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as Promise<bigint>,
        client.readContract({
          address: USDC_TOKEN_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
      ]);
      usdcBalance = Number(formatUnits(usdcRaw, usdcDecimals));
    } catch (err) {
      console.warn('[KYC] usdc balance read failed:', err);
    }
  }

  const txScore      = scoreFromTxCount(txCount);
  const balanceScore = scoreFromNativeBalance(nativeBalanceEth);
  const usdcScore    = scoreFromUsdcBalance(usdcBalance);

  // Weighted credit score: tx activity is primary, then native balance and USDC collateral.
  const creditScore = clampScore(txScore * 0.6 + balanceScore * 0.2 + usdcScore * 0.2);
  const tier = tierFromCreditScore(creditScore);

  console.log('[KYC] Credit score result:', {
    txCount,
    nativeBalanceEth: Number(nativeBalanceEth.toFixed(6)),
    usdcBalance: Number(usdcBalance.toFixed(6)),
    txScore, balanceScore, usdcScore, creditScore, tier,
  });

  return {
    txCount,
    nativeBalanceEth: Number(nativeBalanceEth.toFixed(6)),
    usdcBalance: Number(usdcBalance.toFixed(6)),
    txScore, balanceScore, usdcScore, creditScore, tier,
  };
}

// POST /api/kyc/issue — Sign tier credential derived from wallet credit score
router.post('/issue', async (req: Request, res: Response) => {
  try {
    const { address } = req.body as { address: string };
    console.log('[KYC] Received request:', { address });

    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      console.log('[KYC] Invalid address format:', address);
      return res.status(400).json({ error: 'Invalid address' });
    }

    const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
    if (!ORACLE_PRIVATE_KEY) {
      return res.status(503).json({
        error: 'Oracle not configured — set ORACLE_PRIVATE_KEY in .env'
      });
    }

    console.log('[KYC] POST /api/kyc/issue — address:', address);
    const scoreAssessment = await assessCreditScore(address as `0x${string}`);
    const tier   = scoreAssessment.tier;
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600); // 30 days
    console.log('[KYC] Signing credential — tier:', tier, '| expiry:', new Date(Number(expiry) * 1000).toISOString());

    // Random 253-bit nonce
    const nonceBytes = new Uint8Array(31);
    crypto.getRandomValues(nonceBytes);
    const nonce = BigInt('0x' + Buffer.from(nonceBytes).toString('hex'));

    const walletAddrBI = BigInt(address);

    // Compute message hash: Poseidon(walletAddr, tier, creditScore, expiry, nonce)
    const poseidon = await buildPoseidon();
    const msgHashRaw = poseidon([
      walletAddrBI,
      BigInt(tier),
      BigInt(scoreAssessment.creditScore),
      expiry,
      nonce,
    ]);
    const msgHash = poseidon.F.toObject(msgHashRaw) as bigint;

    // Sign with oracle's Baby Jubjub key
    const privKeyBuf = Buffer.from(ORACLE_PRIVATE_KEY, 'hex');
    const sig    = signMessage(privKeyBuf, msgHash);
    const pubKey = derivePublicKey(privKeyBuf);

    return res.json({
      address,
      tier,
      expiry:   expiry.toString(),
      nonce:    nonce.toString(),
      sigR8x:   sig.R8[0].toString(),
      sigR8y:   sig.R8[1].toString(),
      sigS:     sig.S.toString(),
      pubKeyAx: pubKey[0].toString(),
      pubKeyAy: pubKey[1].toString(),
      creditScore: scoreAssessment.creditScore,
      scoreBreakdown: {
        txCount:          scoreAssessment.txCount,
        nativeBalanceEth: scoreAssessment.nativeBalanceEth,
        usdcBalance:      scoreAssessment.usdcBalance,
        txScore:          scoreAssessment.txScore,
        balanceScore:     scoreAssessment.balanceScore,
        usdcScore:        scoreAssessment.usdcScore,
      },
    });
  } catch (err) {
    console.error('[KYC] /api/kyc/issue error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/kyc/:address — Query derived KYC tier
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const scoreAssessment = await assessCreditScore(address as `0x${string}`);
    return res.json({
      address,
      tier:        scoreAssessment.tier,
      creditScore: scoreAssessment.creditScore,
      scoreBreakdown: {
        txCount:          scoreAssessment.txCount,
        nativeBalanceEth: scoreAssessment.nativeBalanceEth,
        usdcBalance:      scoreAssessment.usdcBalance,
        txScore:          scoreAssessment.txScore,
        balanceScore:     scoreAssessment.balanceScore,
        usdcScore:        scoreAssessment.usdcScore,
      },
    });
  } catch (err) {
    console.error('[KYC] /api/kyc/:address error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as kycRouter };

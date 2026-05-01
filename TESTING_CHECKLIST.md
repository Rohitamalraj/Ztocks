# 🧪 Testing Checklist

## ✅ Servers Running

- ✅ **Backend**: http://localhost:3001 (Running)
- ✅ **Frontend**: http://localhost:3000 (Running)

---

## 📋 Test Scenarios

### 1. **Basic Connectivity** ✅

- [ ] Open http://localhost:3000
- [ ] Page loads without errors
- [ ] Can see landing page
- [ ] Navigation works

### 2. **Wallet Connection** 🔗

- [ ] Click "Connect Wallet"
- [ ] MetaMask opens
- [ ] Switch to Sepolia testnet
- [ ] Wallet connects successfully
- [ ] Address shows in UI

**Sepolia Testnet**:
- Chain ID: 11155111
- RPC: https://rpc.sepolia.org

### 3. **Get Test Funds** 💰

**Sepolia ETH** (for gas):
- [ ] Visit https://sepoliafaucet.com/
- [ ] Request 0.5 ETH
- [ ] Check balance in MetaMask

**Test USDC** (for collateral):
- [ ] Visit https://faucet.circle.com/
- [ ] Request 1000 USDC
- [ ] Check USDC balance

**Contract Address**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

### 4. **Wrap USDC → cUSDC** 🔄

- [ ] Go to Trade page
- [ ] See USDC balance
- [ ] Click "Wrap USDC"
- [ ] Approve USDC spending
- [ ] Wrap 100 USDC → cUSDC
- [ ] Transaction confirms
- [ ] cUSDC balance updates (encrypted)

**Expected**:
- 2 transactions: approve + wrap
- Gas cost: ~0.001 ETH total
- cUSDC balance shows as encrypted handle

### 5. **KYC Verification** 🆔

- [ ] Click "Verify Identity"
- [ ] Enter credit score (e.g., 750)
- [ ] Backend issues credential
- [ ] ZK proof generates (client-side)
- [ ] Submit proof on-chain
- [ ] Transaction confirms
- [ ] Tier shows in UI (e.g., "Tier 2")

**Expected**:
- Proof generation: ~5-10 seconds
- Transaction: ~0.0005 ETH gas
- Tier determines max leverage:
  - Tier 1: 2x
  - Tier 2: 5x
  - Tier 3: 8x
  - Tier 4: 10x

### 6. **Open Position** 📈

- [ ] Select asset (e.g., csAAPL)
- [ ] Choose direction (LONG/SHORT)
- [ ] Enter collateral (e.g., 50 cUSDC)
- [ ] Select leverage (e.g., 3x)
- [ ] Click "Open Position"
- [ ] FHE encryption happens (client-side)
- [ ] Transaction confirms
- [ ] Position appears in portfolio

**Expected**:
- Encryption: ~2-3 seconds
- Transaction: ~0.002 ETH gas
- Position data encrypted on-chain
- Only you can decrypt your position

### 7. **View Portfolio** 👀

- [ ] Go to Portfolio page
- [ ] See open positions
- [ ] Click "Decrypt" on position
- [ ] Enter wallet password
- [ ] Position details decrypt
- [ ] See collateral, leverage, P&L

**Expected**:
- Decryption: ~1-2 seconds
- No gas cost (local decryption)
- Other users can't see your data

### 8. **Close Position** 📉

- [ ] Go to Portfolio
- [ ] Click "Close" on position
- [ ] Confirm transaction
- [ ] Position closes
- [ ] Synth tokens burned
- [ ] Collateral + P&L returned

**Expected**:
- Transaction: ~0.001 ETH gas
- Instant settlement
- Balance updates

### 9. **Unwrap cUSDC → USDC** 🔄

- [ ] Click "Unwrap cUSDC"
- [ ] Enter amount
- [ ] Request unwrap (Step 1)
- [ ] Wait for relayer (~30 seconds)
- [ ] Unwrap finalizes (Step 2)
- [ ] USDC balance updates

**Expected**:
- 2 steps: request + finalize
- Total gas: ~0.0015 ETH
- Async process (requires relayer)

---

## 🔍 What to Check

### Frontend Console

Open browser DevTools (F12) and check for:
- ✅ No errors in console
- ✅ Contract addresses loaded
- ✅ FHE library initialized
- ✅ Wallet connected

### Network Tab

Check transactions:
- ✅ Transactions sent to Sepolia
- ✅ Transactions confirm
- ✅ Gas estimates reasonable

### Contract Interactions

Verify on Etherscan:
- ✅ Transactions appear
- ✅ Events emitted
- ✅ State changes recorded

**Vault**: https://sepolia.etherscan.io/address/0xb423EB8C27524CFbCB2A70E81468a963968dE66B

---

## 🐛 Common Issues

### Issue: "Network mismatch"
**Fix**: Switch MetaMask to Sepolia (Chain ID: 11155111)

### Issue: "Insufficient funds"
**Fix**: Get test ETH and USDC from faucets

### Issue: "Transaction failed"
**Fix**: Check gas limit, try increasing

### Issue: "FHE encryption fails"
**Fix**: Make sure wallet is connected and on correct network

### Issue: "Can't decrypt position"
**Fix**: Make sure you're the position owner and wallet is unlocked

---

## ✅ Success Criteria

Your deployment is successful when you can:

1. ✅ Connect wallet to Sepolia
2. ✅ Wrap USDC → cUSDC
3. ✅ Submit KYC and get verified
4. ✅ Open encrypted position
5. ✅ View and decrypt your position
6. ✅ Close position
7. ✅ Unwrap cUSDC → USDC

**All with encrypted balances and positions! 🔒**

---

## 📊 Test Results

| Test | Status | Notes |
|------|--------|-------|
| Wallet Connection | ⏳ | |
| Get Test Funds | ⏳ | |
| Wrap USDC | ⏳ | |
| KYC Verification | ⏳ | |
| Open Position | ⏳ | |
| View Portfolio | ⏳ | |
| Close Position | ⏳ | |
| Unwrap cUSDC | ⏳ | |

**Legend**: ⏳ Pending | ✅ Pass | ❌ Fail

---

## 🚀 Ready to Test!

**Open**: http://localhost:3000  
**Connect**: MetaMask on Sepolia  
**Trade**: With complete privacy! 🔒

**Let's test the most private DeFi protocol ever built! 🎯**

# Transaction Troubleshooting Guide

## Issue: Transaction Hash Shown but Not Confirmed

When you submit a transaction, Wagmi immediately returns a transaction hash after you sign it in MetaMask. However, this doesn't mean the transaction is confirmed on the blockchain. Here's what's happening:

### The Transaction Lifecycle

1. **Sign** → You approve the transaction in MetaMask
2. **Hash** → Wagmi returns the transaction hash immediately
3. **Submit** → Transaction is sent to the blockchain
4. **Pending** → Transaction waits in the mempool
5. **Confirm** → Transaction is included in a block
6. **Success/Fail** → Transaction result

### What I've Added to Help Debug

#### 1. **Network Status Component**
- Shows if you're connected to the correct network (Base Sepolia)
- Displays your wallet address
- Warns if you're on the wrong network

#### 2. **Contract Debug Component**
- Verifies the factory contract is readable
- Shows the number of deployed tokens
- Displays main token information
- Helps identify if contracts are deployed correctly

#### 3. **Better Transaction Feedback**
- ⏳ "Waiting for signature" - MetaMask popup open
- ⏳ "Transaction submitted" - Hash received, waiting for confirmation
- ⏳ "Confirming on blockchain" - Waiting for block inclusion
- ✅ "Success" - Transaction confirmed
- ❌ "Error" - Transaction failed or reverted

#### 4. **BaseScan Links**
- Click to view your transaction on BaseScan
- See if the transaction is pending, confirmed, or failed
- View error messages if transaction reverted

## Common Issues & Solutions

### Issue 1: Wrong Network
**Symptom:** Transaction appears to work but nothing happens

**Solution:**
- Open MetaMask
- Switch to "Base Sepolia" network
- If you don't see it, add it:
  - Network Name: Base Sepolia
  - RPC URL: https://sepolia.base.org
  - Chain ID: 84532
  - Currency Symbol: ETH

### Issue 2: Insufficient Gas
**Symptom:** Transaction reverts immediately

**Solution:**
- Make sure you have ETH on Base Sepolia for gas fees
- Get testnet ETH from Base Sepolia faucet

### Issue 3: Contract Not Deployed
**Symptom:** "Cannot read properties" errors in Contract Debug

**Solution:**
- Verify contract addresses in deployed-addresses-base-sepolia.txt
- Check contracts on BaseScan: https://sepolia.basescan.org/address/CONTRACT_ADDRESS
- Redeploy contracts if needed

### Issue 4: Transaction Reverts
**Symptom:** Hash shown, but BaseScan shows "Reverted"

**Common Causes:**
- Empty name or symbol (contract requires non-empty strings)
- Invalid mint rate (must be > 0)
- Not enough gas provided
- Contract bug or require() statement failing

**Solution:**
- Click the BaseScan link to see the revert reason
- Check all form inputs are valid
- Try with default values first (Name: "Test", Symbol: "TST", Rate: "10")

## How to Test

### Step 1: Check Contract Status
1. Go to "Create Token" tab
2. Look at the "🔍 Contract Status" section
3. Verify:
   - Factory address matches deployed address
   - Main Token shows correct address
   - "Deployed Tokens" shows a number (starts at 0)
   - Main Token name and symbol are visible

### Step 2: Connect Wallet
1. Click "Connect with Injected"
2. Approve in MetaMask
3. Check the green "✅ Connected to Base Sepolia" message
4. If red error, switch networks in MetaMask

### Step 3: Create a Test Token
1. Fill in form:
   - Name: "Test Reputation"
   - Symbol: "TEST"
   - Metadata: (leave empty)
   - Mint Rate: "10"
2. Click "Create Token"
3. Approve in MetaMask
4. Watch the status messages:
   - Should show "Waiting for signature..."
   - Then "Transaction submitted"
   - Then "Confirming on blockchain..."
   - Finally "✅ Success"
5. Click "View on BaseScan" to verify

### Step 4: Check BaseScan
Visit the BaseScan link and verify:
- ✅ Status: Success (green checkmark)
- ✅ Block: Shows a block number
- ✅ From: Your wallet address
- ✅ To: Factory contract address

If Status shows "Fail":
- Click on the transaction
- Look for "Revert Reason" or "Error Message"
- This tells you exactly what went wrong

## Quick Checklist

Before creating a token, verify:

- [ ] Wallet connected to Base Sepolia
- [ ] Contract Debug shows valid data
- [ ] You have ETH for gas (0.001+ ETH)
- [ ] Form fields are filled correctly
- [ ] Name and symbol are not empty
- [ ] Mint rate is a positive number

## Getting Test ETH

If you need Base Sepolia ETH for gas:

1. **Alchemy Faucet**: https://www.alchemy.com/faucets/base-sepolia
2. **Coinbase Faucet**: https://www.coinbase.com/faucets/base-sepolia-faucet
3. **Bridge from Sepolia**: Use the official Base bridge

## Still Having Issues?

1. **Check Browser Console**: Press F12 and look for errors
2. **Check MetaMask Activity**: See if transaction is pending
3. **Clear MetaMask Cache**: Settings → Advanced → Clear activity data
4. **Try Different RPC**: Switch Base Sepolia RPC endpoint
5. **Verify Contract Code**: Check factory contract on BaseScan is verified

## Expected Behavior

When everything works correctly:

1. Click "Create Token"
2. MetaMask pops up → Approve
3. Status shows "Transaction submitted" with hash
4. Status updates to "Confirming on blockchain"
5. After ~2-5 seconds, shows "✅ Success"
6. BaseScan link confirms transaction
7. "Deployed Tokens" count increases by 1
8. Token appears in GraphQL subgraph (may take 30-60 seconds)

## Developer Notes

The transaction flow uses:
- `useWriteContract()` - Sends transaction, returns hash immediately
- `useWaitForTransactionReceipt()` - Waits for blockchain confirmation
- Hash is returned BEFORE confirmation (this is normal Ethereum behavior)
- Always check `isSuccess` or view on block explorer to verify

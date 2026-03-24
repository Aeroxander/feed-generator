# Quick Start Guide - Token-Based Bluesky Feed

## Overview

You now have a Bluesky feed generator that ranks posts based on token holder balances. The system automatically extracts Ethereum addresses from Bluesky DID documents and ranks posts by token holdings.

## What Was Created

### Core Services
- **DidResolverService** (`src/services/did-resolver.ts`): Automatically extracts Ethereum addresses from DID documents via the `alsoKnownAs` field
- **TokenService** (`src/services/token-service.ts`): Fetches token holder balances from subgraph or Etherscan
- **WalletMappingService** (`src/services/wallet-mapping.ts`): Manages DID-to-wallet mappings with caching

### Feed Algorithms
All feeds rank posts by token balance (highest holders first):
- `token-hourly` - Last 1 hour
- `token-daily` - Last 24 hours  
- `token-weekly` - Last 7 days
- `token-monthly` - Last 30 days

### Database Tables
- `post` - Stores all posts with author DIDs
- `wallet_mapping` - Caches DID → Ethereum address mappings
- `token_balance` - Stores token balances for each wallet

### Utility Scripts
- `yarn syncTokenHolders` - Sync token holder balances
- `yarn resolveDids <did1> <did2>` - Manually resolve DIDs to wallets

## Setup Steps

### 1. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
# Required: Your token contract address
TOKEN_ADDRESS="0x..."

# Recommended: Your subgraph URL
SUBGRAPH_URL="https://api.thegraph.com/..."

# ENS to AT Protocol domain mapping
CUSTOM_DOMAINS="social,creaton.social"

# Or use Etherscan as fallback
# ETHERSCAN_API_KEY="..."
```

**Important**: Set `CUSTOM_DOMAINS` to match your project's AT Protocol handles. If your users have ENS like `alice.creaton.eth` and AT handles like `alice.creaton.social`, use `"social,creaton.social"`.

### 2. Sync Token Holders

This step does 3 things:
1. Fetches token balances from subgraph
2. **Discovers DIDs via ENS** 🔍
3. Builds the token holder whitelist

```bash
yarn syncTokenHolders
```

You should see output like:
```
=== Step 1: Syncing token holder balances ===
Updated 150 token balances

=== Step 2: Discovering DIDs via ENS ===
Using domains: social, creaton.social
✓ Found DIDs: 87
✗ Not found: 63

=== Step 3: Building token holder DID list ===
✓ Sync completed! Tracking 87 token holder DIDs
```

**Set up cron job for automatic syncing** (every hour):
```bash
crontab -e
# Add: 0 * * * * cd /path/to/project && yarn syncTokenHolders >> sync.log 2>&1
```

### 3. Start the Feed Generator

```bash
yarn start
```

### 4. Publish Your Feeds

```bash
yarn publishFeed
```

Publish each feed:
- `token-hourly` - "Top Token Holders (Hourly)"
- `token-daily` - "Top Token Holders (Daily)"
- `token-weekly` - "Top Token Holders (Weekly)"
- `token-monthly` - "Top Token Holders (Monthly)"

## How It Works

### The ENS Bridge 🌉

The system uses **ENS as a bridge** to efficiently discover token holder DIDs:

```
Wallet Address → ENS Name → AT Protocol Handle → Bluesky DID
  0x1234...   → alice.creaton.eth → alice.creaton.social → did:plc:abc123
```

### Process Flow

1. **Sync Token Holders**: Get wallet addresses with balances from subgraph
2. **ENS Discovery**: For each wallet:
   - Reverse ENS lookup → find ENS name
   - Convert ENS to AT handle (`.eth` → `.social`)
   - Resolve AT handle → get DID
3. **Build Whitelist**: Store discovered DIDs in `token_holder` table
4. **Selective Collection**: Firehose only stores posts from whitelisted DIDs
5. **Ranking**: Order posts by token balance, then by time

### Why This Is Efficient

**Old Approach**: Collect all posts → filter by token balance (slow)
**New Approach**: Build DID whitelist → collect only relevant posts (fast!) ✅

## Subgraph Requirements

Your subgraph should expose token holder data. Example query:

```graphql
query GetTokenHolders($tokenAddress: String!) {
  reputationToken(id: $tokenAddress) {
    holders {
      user          # Ethereum address
      netReputation # Token balance
    }
  }
}
```

**Note**: The existing subgraph in `rptoken-reference/src/graphql/queries.ts` already has this structure!

## Customization

### Adjust Time Windows
Edit the time constants in `src/algos/token-*.ts`:
```typescript
const HOUR_IN_MS = 60 * 60 * 1000
const DAY_IN_MS = 24 * 60 * 60 * 1000
// etc.
```

### Include Non-Token Holders
To show posts from users without tokens, comment out the filter in each algo:
```typescript
// const filteredRes = res.filter(row => row.balance && parseFloat(row.balance) > 0)
const filteredRes = res // Show all posts
```

### Custom Ranking Logic
Modify the `orderBy` clauses in feed algorithms for different ranking strategies.

## Testing

### Test ENS Discovery
```bash
# Discover DIDs for specific addresses
yarn discoverEns 0x1234... 0x5678...

# Discover all unmapped token holders
yarn discoverEns --all
```

### Test DID Resolution
```bash
yarn resolveDids did:plc:abc123
```

### Manually Add Mapping
```bash
yarn addMapping did:plc:abc123 0x1234567890abcdef
```

### Check Database
```bash
sqlite3 feed-database.sqlite
> SELECT COUNT(*) FROM token_balance;
> SELECT COUNT(*) FROM token_holder WHERE isActive=1;
> SELECT * FROM wallet_mapping LIMIT 5;
```

### Test a Feed
Once running, access:
```
http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://your-did/app.bsky.feed.generator/token-daily
```

## Troubleshooting

**No posts showing up?**
1. Run `yarn syncTokenHolders` to discover DIDs and populate balances
2. Check if token holders have ENS names: `yarn discoverEns --all`
3. Verify `CUSTOM_DOMAINS` matches your project's AT handles
4. Check logs: Should see "Tracking X token holder DIDs"

**No DIDs discovered?**
1. Verify token holders have ENS names registered
2. Check if AT Protocol handles exist (e.g., `alice.creaton.social`)
3. Try different domains: `CUSTOM_DOMAINS="social,bsky.social,yourproject.social"`
4. Manually add mappings: `yarn addMapping <did> <wallet>`

**Balances not updating?**
1. Check SUBGRAPH_URL or ETHERSCAN_API_KEY
2. Run manual sync: `yarn syncTokenHolders`
3. Check logs for errors

**Performance issues?**
1. Run sync less frequently (e.g., every 2-4 hours)
2. The whitelist approach is already optimized - should be fast!
3. Check database size: `SELECT COUNT(*) FROM token_holder WHERE isActive=1;`

## Next Steps

1. Configure your environment variables
2. Run initial token holder sync
3. Start the feed generator
4. Publish your feeds
5. Set up cron job for automatic syncing
6. Monitor logs and adjust as needed

For detailed documentation, see `TOKEN_FEED_SETUP.md`.

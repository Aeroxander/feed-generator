# ENS Discovery Guide

## Overview

The feed generator now uses **ENS (Ethereum Name Service) as a bridge** to discover Bluesky DIDs for token holders. This is more efficient than collecting all posts from the firehose.

## How It Works

### The ENS Bridge

```
Token Holder Address → ENS Name → AT Protocol Handle → Bluesky DID
     0x1234...      → alice.creaton.eth → alice.creaton.social → did:plc:abc123
```

### Example

1. Your subgraph returns: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
2. ENS reverse lookup finds: `alice.creaton.eth`
3. System tries these handles:
   - `alice.creaton.social`
   - `alice.creaton.creaton.social`
4. If `alice.creaton.social` exists → resolves to `did:plc:abc123...`
5. DID is added to the token holder whitelist
6. Only posts from whitelisted DIDs are collected

## Configuration

### Environment Variables

```bash
# Required: Token contract
TOKEN_ADDRESS="0x..."

# Required: Data source
SUBGRAPH_URL="https://..."

# ENS to AT Protocol domain mapping
CUSTOM_DOMAINS="social,creaton.social"
```

The `CUSTOM_DOMAINS` variable tells the system which domains to try when converting ENS names to AT Protocol handles.

**Example**: If `CUSTOM_DOMAINS="social,creaton.social"` and ENS is `alice.creaton.eth`:
- Try 1: `alice.creaton.social`
- Try 2: `alice.creaton.creaton.social`

## Usage

### Automatic Discovery (Recommended)

Run the sync script - it handles everything:

```bash
yarn syncTokenHolders
```

This will:
1. Fetch token holder balances
2. Discover DIDs via ENS for unmapped holders
3. Update the token holder whitelist

### Manual Discovery

Discover DIDs for specific addresses:

```bash
yarn discoverEns 0x1234... 0x5678...
```

Discover all unmapped token holders:

```bash
yarn discoverEns --all
```

### Manual Mapping

For holders without ENS or matching handles:

```bash
yarn addMapping did:plc:abc123 0x1234567890abcdef
```

## Why This Approach?

### Before (Inefficient)
- Collect ALL posts from firehose
- Check each author's DID for wallet link
- Filter by token balance
- Very high database and processing load

### After (Efficient) ✅
- Build whitelist of token holder DIDs via ENS
- Only collect posts from whitelisted DIDs
- Minimal processing, much faster

## Expected Results

After running `yarn syncTokenHolders`, you'll see:

```
=== Step 1: Syncing token holder balances ===
Updated 150 token balances

=== Step 2: Discovering DIDs via ENS ===
Using domains: social, creaton.social

Discovering DID for wallet 0x1234...
  ✓ Found ENS name: alice.creaton.eth
  Trying handle: alice.creaton.social
  ✓ Found DID: did:plc:abc123...

...

=== Discovery Results ===
✓ Found DIDs: 87
✗ Not found: 63

=== Step 3: Building token holder DID list ===
✓ Found DID for 0x1234...: did:plc:abc123...
...

✓ Sync completed! Tracking 87 token holder DIDs
```

## What About Token Holders Without ENS?

Token holders who don't have:
- ENS name
- Matching AT Protocol handle
- DID document with wallet link

**Won't appear in the feed** until you:
1. They set up ENS with matching AT handle
2. They link wallet in DID document  
3. You manually add mapping: `yarn addMapping <did> <wallet>`

## Troubleshooting

### No DIDs discovered

1. Check ENS names exist: Visit `https://app.ens.domains` and search addresses
2. Verify AT Protocol handles: Check if `<name>.creaton.social` exists on Bluesky
3. Try adding more domains: Update `CUSTOM_DOMAINS="social,creaton.social,bsky.social"`

### Wrong DIDs discovered

1. Check domain configuration: Make sure `CUSTOM_DOMAINS` matches your project's handles
2. Verify ENS → handle pattern: Ensure your users follow the naming convention

### Rate limiting errors

The script includes delays between requests (200ms). If you still hit limits:
1. Increase delay in `src/services/ens-discovery.ts`
2. Run discovery in smaller batches using `yarn discoverEns`

## ENS Graph API

The system uses The Graph's ENS subgraph:
```
https://api.thegraph.com/subgraphs/name/ensdomains/ens
```

This is a public endpoint. For production with many holders, consider:
- Using your own Graph node
- Caching ENS lookups aggressively
- Running discovery less frequently

## Naming Convention Recommendation

For best results, encourage your token holders to:
1. Register ENS: `username.yourproject.eth`
2. Register AT handle: `username.yourproject.social`
3. Use same `username` in both

This maximizes automatic discovery rate!

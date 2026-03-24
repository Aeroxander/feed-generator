# Token-Based Bluesky Feed Generator

This feed generator creates Bluesky feeds that rank posts based on token holder balances. Posts are ordered by the amount of tokens the author holds, with time-based filtering options.

## Features

- **Automatic DID to Wallet Resolution**: Extracts Ethereum addresses directly from Bluesky DID documents (via `alsoKnownAs` field)
- **Token Balance Integration**: Fetches token holder balances from GraphQL subgraph or Etherscan API
- **Multiple Feed Timeframes**:
  - `token-hourly`: Posts from the last hour, ranked by token balance
  - `token-daily`: Posts from the last 24 hours, ranked by token balance
  - `token-weekly`: Posts from the last 7 days, ranked by token balance
  - `token-monthly`: Posts from the last 30 days, ranked by token balance

## How It Works

### Efficient Post Filtering
Instead of collecting ALL posts and filtering, the system uses a whitelist approach:

1. **Token Holder Discovery**: 
   - Get token holders (wallet addresses) from subgraph
   - Use **ENS as a bridge** to find DIDs:
     - Reverse ENS lookup: wallet → ENS name (e.g., `alice.creaton.eth`)
     - Convert ENS to AT Protocol handle (e.g., `alice.creaton.social`)
     - Resolve handle to DID
   - Also checks DID documents for `alsoKnownAs` field with wallet addresses
   - Builds a whitelist of token holder DIDs

2. **Selective Post Collection**: 
   - Firehose subscription only stores posts from whitelisted DIDs
   - Dramatically reduces database load and processing

3. **Feed Ranking**: 
   - Posts are ranked by token balance (highest first)
   - Recency used as tiebreaker

## Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required - Bluesky Feed Configuration
FEEDGEN_PORT=3000
FEEDGEN_LISTENHOST=localhost
FEEDGEN_HOSTNAME=example.com
FEEDGEN_SERVICE_DID=did:web:example.com
FEEDGEN_PUBLISHER_DID=did:plc:your-publisher-did
FEEDGEN_SQLITE_LOCATION=./feed-database.sqlite
FEEDGEN_SUBSCRIPTION_ENDPOINT=wss://bsky.network

# Required - Token Configuration
TOKEN_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

# Optional - Choose ONE data source
# Option 1: GraphQL Subgraph (Recommended)
SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/your-subgraph

# Option 2: Etherscan API (Fallback)
ETHERSCAN_API_KEY=your-etherscan-api-key
```

### Installation

```bash
# Install dependencies
yarn install

# Build the project
yarn build
```

### Running the Feed Generator

```bash
# Start the feed generator
yarn start
```

### Syncing Token Holder Balances

The sync process does three things:
1. Fetches token balances from subgraph/Etherscan
2. **Discovers DIDs via ENS** for unmapped token holders
3. Updates the whitelist of token holder DIDs to track

Run the sync manually:

```bash
yarn syncTokenHolders
```

**Recommended**: Set up a cron job to sync regularly (e.g., every hour):

```bash
# Edit crontab
crontab -e

# Add this line to sync every hour
0 * * * * cd /path/to/bluesky-token-feed && yarn syncTokenHolders >> /var/log/token-sync.log 2>&1
```

### Manual ENS Discovery

To discover DIDs for specific addresses:

```bash
# Single or multiple addresses
yarn discoverEns 0x1234... 0x5678...

# All unmapped token holders
yarn discoverEns --all
```

### Publishing Your Feeds

After starting the feed generator, publish your feeds to Bluesky:

```bash
yarn publishFeed
```

When prompted, enter the feed details for each algorithm:
- `token-hourly` - "Top Token Holders (Hourly)"
- `token-daily` - "Top Token Holders (Daily)"
- `token-weekly` - "Top Token Holders (Weekly)"
- `token-monthly` - "Top Token Holders (Monthly)"

## Database Schema

### Tables

#### `post`
Stores all posts from the firehose:
- `uri`: Post URI (primary key)
- `cid`: Content identifier
- `author`: DID of the post author
- `indexedAt`: Timestamp when post was indexed

#### `wallet_mapping`
Caches DID to wallet address mappings (discovered via ENS or DID documents):
- `did`: Bluesky DID (primary key)
- `walletAddress`: Ethereum address
- `verifiedAt`: When mapping was first created
- `lastUpdated`: When mapping was last updated

#### `token_balance`
Stores token balances for wallet addresses:
- `walletAddress`: Ethereum address (primary key)
- `balance`: Token balance as string
- `lastUpdated`: When balance was last synced

#### `token_holder`
Whitelist of DIDs that hold tokens (only these users' posts are collected):
- `did`: Bluesky DID (primary key)
- `isActive`: Whether this DID currently holds tokens
- `lastChecked`: When this DID was last verified

## Architecture

### Services

#### `DidResolverService`
- Resolves DID documents from PLC directory
- Extracts Ethereum addresses from `alsoKnownAs` field
- Caches results in database and memory

#### `EnsDiscoveryService` ⭐ NEW
- **Discovers DIDs via ENS names**
- Reverse ENS lookup: wallet address → ENS name
- Converts ENS to AT Protocol handle (e.g., `.eth` → `.social`)
- Resolves AT Protocol handle to DID
- Batch processes unmapped token holders

#### `TokenService`
- Fetches token holder data from subgraph or Etherscan
- Updates token balances in database
- Provides balance lookup by wallet or DID

#### `TokenHolderService`
- Manages the whitelist of token holder DIDs
- Syncs DIDs from wallet mappings
- Marks inactive holders (zero balance)

#### `WalletMappingService`
- Manages DID to wallet mappings
- Provides batch operations for mappings

### Feed Algorithms

All token-based feeds follow the same pattern:
1. Filter posts by time range (hour/day/week/month)
2. Join with wallet mappings to get Ethereum addresses
3. Join with token balances to get token amounts
4. Order by balance (descending) and then by time
5. Filter out posts from users without token balances (optional)

## Data Sources

### GraphQL Subgraph (Recommended)

The subgraph should provide a query like:

```graphql
query GetTokenHolders($tokenAddress: String!) {
  reputationToken(id: $tokenAddress) {
    holders {
      user
      netReputation
    }
  }
}
```

### Etherscan API (Fallback)

Uses Etherscan's `tokenbalance` endpoint. Note: This requires knowing wallet addresses in advance, so it's better used as a fallback or for specific address lists.

## Customization

### Adjusting Time Ranges

Edit the constants in each feed algorithm file:
- `src/algos/token-hourly.ts`: `HOUR_IN_MS`
- `src/algos/token-daily.ts`: `DAY_IN_MS`
- `src/algos/token-weekly.ts`: `WEEK_IN_MS`
- `src/algos/token-monthly.ts`: `MONTH_IN_MS`

### Including Non-Token Holders

To show posts from users without token balances at the end of the feed, remove or comment out this line in each algorithm:

```typescript
const filteredRes = res.filter(row => row.balance && parseFloat(row.balance) > 0)
```

### Custom Ranking Logic

You can modify the `orderBy` clauses in each feed algorithm to implement different ranking strategies, such as:
- Weighted scoring (balance × recency)
- Engagement metrics (if available)
- Combined rankings

## DID Discovery Methods

The system uses two methods to link token holders to DIDs:

### Method 1: ENS Bridge (Primary) ⭐

Most token holders have ENS names. The system uses ENS as a bridge:

1. **Token Holder** → Wallet Address (e.g., `0x1234...`)
2. **Reverse ENS Lookup** → ENS Name (e.g., `alice.creaton.eth`)
3. **Convert to AT Handle** → AT Protocol Handle (e.g., `alice.creaton.social`)
4. **Resolve Handle** → DID (e.g., `did:plc:abc123...`)

Configuration via `CUSTOM_DOMAINS` env variable:
```bash
CUSTOM_DOMAINS="social,creaton.social,yourproject.social"
```

This will try multiple domains when converting ENS to AT handles.

### Method 2: DID Document (Fallback)

If a user has linked their wallet in their DID document:

```json
{
  "id": "did:plc:abc123...",
  "alsoKnownAs": [
    "at://handle.bsky.social",
    "did:pkh:eip155:1:0x1234567890abcdef..."
  ]
}
```

The format follows [CAIP-10](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-10.md):
- `did:pkh` - DID method for blockchain addresses
- `eip155` - Ethereum namespace
- `1` - Chain ID (1 = Ethereum mainnet)
- `0x...` - Ethereum address

### Manual Mapping

For users without ENS or DID-linked wallets:

```bash
yarn addMapping did:plc:abc123 0x1234567890abcdef
```

## Troubleshooting

### No posts appearing in feed

1. Check that token holder sync is running: `yarn syncTokenHolders`
2. Verify that users have linked Ethereum addresses in their DID documents
3. Check logs for DID resolution errors

### Token balances not updating

1. Verify your subgraph URL or Etherscan API key
2. Check the token contract address is correct
3. Run manual sync: `yarn syncTokenHolders`
4. Check database: `sqlite3 feed-database.sqlite "SELECT COUNT(*) FROM token_balance;"`

### Performance issues

1. Add database indexes if needed
2. Adjust caching in `DidResolverService`
3. Batch DID resolution operations
4. Consider running sync less frequently

## Development

### Adding New Feed Algorithms

1. Create a new file in `src/algos/` (e.g., `token-custom.ts`)
2. Implement the feed logic with `shortname` and `handler` exports
3. Register it in `src/algos/index.ts`
4. Rebuild and restart the feed generator

### Testing

Test individual components:

```typescript
import { DidResolverService } from './src/services/did-resolver'

// Test DID resolution
const resolver = new DidResolverService(db)
const address = await resolver.getEthereumAddressForDid('did:plc:...')
console.log(address)
```

## License

MIT

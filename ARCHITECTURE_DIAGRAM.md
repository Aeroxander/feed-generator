# System Flow Diagram

## Complete Token-Based Feed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TOKEN HOLDERS SYNC                           │
│                      (Run hourly via cron)                          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   Step 1: Fetch Balances  │
                    │   (Subgraph/Etherscan)    │
                    └──────────────────────────┘
                                   │
                    [0x1234..., 0x5678..., 0xABCD...]
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Step 2: ENS Discovery   │
                    │   🌉 The Bridge!          │
                    └──────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
  ┌─────────┐              ┌─────────┐              ┌─────────┐
  │0x1234...│              │0x5678...│              │0xABCD...│
  └─────────┘              └─────────┘              └─────────┘
        │                          │                          │
        │ ENS Reverse Lookup       │                          │
        ▼                          ▼                          ▼
alice.creaton.eth        bob.creaton.eth         (no ENS) ✗
        │                          │
        │ Convert .eth → .social   │
        ▼                          ▼
alice.creaton.social     bob.creaton.social
        │                          │
        │ Resolve Handle → DID     │
        ▼                          ▼
  did:plc:abc123           did:plc:def456
        │                          │
        └──────────────┬───────────┘
                       ▼
        ┌──────────────────────────┐
        │   token_holder Table     │
        │   (Whitelist)            │
        │                          │
        │  did:plc:abc123 ✓       │
        │  did:plc:def456 ✓       │
        └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      LIVE FEED OPERATION                            │
└─────────────────────────────────────────────────────────────────────┘

              ┌─────────────────────────┐
              │   Bluesky Firehose      │
              │   (All posts)           │
              └─────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    Post from       Post from       Post from
  did:plc:abc123  did:plc:xyz999  did:plc:def456
          │              │              │
          │              │              │
    ┌─────▼──────────────▼──────────────▼─────┐
    │    Subscription Filter (Fast!)           │
    │    Check: Is DID in token_holder?        │
    └──────┬───────────────┬───────────────┬───┘
           │               │               │
      ✓ In whitelist  ✗ Not in list  ✓ In whitelist
           │               │               │
           ▼               ▼               ▼
    Store in DB      SKIP (Fast!)    Store in DB
           │                               │
           └───────────────┬───────────────┘
                           ▼
                  ┌─────────────────┐
                  │   post Table    │
                  │  (Token holders │
                  │   only!)        │
                  └─────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      FEED GENERATION                                │
└─────────────────────────────────────────────────────────────────────┘

              User requests feed (hourly/daily/weekly/monthly)
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Query with JOINs:       │
                    │  post                    │
                    │  ├─ wallet_mapping       │
                    │  └─ token_balance        │
                    └──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Order by:               │
                    │  1. balance DESC         │
                    │  2. indexedAt DESC       │
                    └──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Return ranked feed      │
                    │  (Top holders first!)    │
                    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     DATABASE SCHEMA                                 │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐         ┌──────────────────┐
    │  token_balance   │         │  wallet_mapping  │
    ├──────────────────┤         ├──────────────────┤
    │ walletAddress PK │◄────────│ walletAddress    │
    │ balance          │         │ did PK           │
    │ lastUpdated      │         │ verifiedAt       │
    └──────────────────┘         │ lastUpdated      │
                                 └────────┬─────────┘
                                          │
                                          │ FK
                                          ▼
                                 ┌──────────────────┐
                                 │  token_holder    │
                                 ├──────────────────┤
                                 │ did PK           │
                                 │ isActive         │
                                 │ lastChecked      │
                                 └────────┬─────────┘
                                          │
                                          │ FK
                                          ▼
                                 ┌──────────────────┐
                                 │      post        │
                                 ├──────────────────┤
                                 │ uri PK           │
                                 │ cid              │
                                 │ author (DID)     │
                                 │ indexedAt        │
                                 └──────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                  PERFORMANCE COMPARISON                             │
└─────────────────────────────────────────────────────────────────────┘

OLD APPROACH (All posts):
┌────────────────────────────────────────────────────────────┐
│ Posts/day: ~1,000,000                                      │
│ Stored: ALL                                                 │
│ Filtered: At query time (slow)                             │
│ DB writes: 1M/day                                          │
│ Query time: Slow (scan + filter)                          │
└────────────────────────────────────────────────────────────┘

NEW APPROACH (Whitelist):
┌────────────────────────────────────────────────────────────┐
│ Posts/day: ~1,000,000                                      │
│ Checked: ALL (fast whitelist lookup)                       │
│ Stored: ~100-1,000 (only token holders)                   │
│ DB writes: 100-1,000/day (100-1000x less!)                │
│ Query time: Fast (pre-filtered)                           │
└────────────────────────────────────────────────────────────┘

EFFICIENCY GAIN: 100-1000x fewer database writes! 🚀


┌─────────────────────────────────────────────────────────────────────┐
│                  KEY SUCCESS FACTORS                                │
└─────────────────────────────────────────────────────────────────────┘

1. ENS Naming Convention
   ✓ ENS: username.creaton.eth
   ✓ AT:  username.creaton.social
   └──> Maximum automatic discovery!

2. Regular Sync
   ✓ Hourly cron job
   ✓ Discovers new holders
   └──> Always up to date!

3. Multiple Discovery Methods
   ✓ ENS bridge (primary)
   ✓ DID document (fallback)
   ✓ Manual mapping (edge cases)
   └──> High coverage!

4. Efficient Filtering
   ✓ Whitelist check at ingestion
   ✓ No wasted storage
   └──> Fast & scalable!

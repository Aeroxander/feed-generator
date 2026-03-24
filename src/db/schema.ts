export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  wallet_mapping: WalletMapping
  token_balance: TokenBalance
  token_holder: TokenHolder
}

export type Post = {
  uri: string
  cid: string
  author: string
  indexedAt: string
  boostScore: number      // USDC total boosted (from Ponder)
  voteScore: number       // net token vote weight (upvotes - downvotes, from token vote appview)
  scoreUpdatedAt: string | null | undefined  // ISO timestamp of last score sync
}


export type SubState = {
  service: string
  cursor: number
}

export type WalletMapping = {
  did: string
  walletAddress: string
  verifiedAt: string
  lastUpdated: string
}

export type TokenBalance = {
  walletAddress: string
  balance: string
  lastUpdated: string
}

export type TokenHolder = {
  did: string
  isActive: number // SQLite uses 0/1 for boolean
  lastChecked: string
}

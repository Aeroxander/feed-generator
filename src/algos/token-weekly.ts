import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'token-weekly'

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

export const handler = async (ctx: AppContext, params: QueryParams) => {
  // Get posts from the last 7 days
  const oneWeekAgo = new Date(Date.now() - WEEK_IN_MS).toISOString()

  let builder = ctx.db
    .selectFrom('post')
    .leftJoin('wallet_mapping', 'post.author', 'wallet_mapping.did')
    .leftJoin('token_balance', 'wallet_mapping.walletAddress', 'token_balance.walletAddress')
    .select([
      'post.uri',
      'post.cid',
      'post.indexedAt',
      'post.author',
      'token_balance.balance',
    ])
    .where('post.indexedAt', '>=', oneWeekAgo)
    .orderBy('token_balance.balance', 'desc') // Order by token balance (highest first)
    .orderBy('post.indexedAt', 'desc') // Then by time for ties
    .limit(params.limit)

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
    builder = builder.where('post.indexedAt', '<', timeStr)
  }

  const res = await builder.execute()

  // Filter out posts from users without token balances (optional)
  // If you want to include all posts, remove this filter
  const filteredRes = res.filter(row => row.balance && parseFloat(row.balance) > 0)

  const feed = filteredRes.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = filteredRes.at(-1)
  if (last) {
    cursor = new Date(last.indexedAt).getTime().toString(10)
  }

  return {
    cursor,
    feed,
  }
}

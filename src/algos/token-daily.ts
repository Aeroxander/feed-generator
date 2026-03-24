import { sql } from 'kysely'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'token-daily'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export const handler = async (ctx: AppContext, params: QueryParams) => {
  // Get posts from the last 24 hours
  const oneDayAgo = new Date(Date.now() - DAY_IN_MS).toISOString()

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
    .where('post.indexedAt', '>=', oneDayAgo)
    .orderBy(sql`CAST(token_balance.balance AS REAL)`, 'desc') // Highest balance first (NULLs last)
    .orderBy('post.indexedAt', 'desc') // Time-based tiebreak
    .limit(params.limit)

  if (params.cursor) {
    // Cursor format: "<balance|null>_<indexedAtMs>"
    // Must match both sort dimensions to avoid posts appearing on multiple pages.
    const sepIdx = params.cursor.indexOf('_')
    const balanceStr = params.cursor.slice(0, sepIdx)
    const tsMs = parseInt(params.cursor.slice(sepIdx + 1), 10)
    const indexedAt = new Date(tsMs).toISOString()

    if (balanceStr === 'null') {
      // Cursor is in the NULL-balance section — only paginate by time within that section
      builder = builder.where((eb) =>
        eb.and([
          sql<boolean>`CAST(token_balance.balance AS REAL) IS NULL`,
          eb('post.indexedAt', '<', indexedAt),
        ])
      )
    } else {
      const balance = parseFloat(balanceStr)
      // Posts with lower balance, OR same balance with older indexedAt, OR NULL balance (always after non-NULL)
      builder = builder.where(
        sql<boolean>`
          CAST(token_balance.balance AS REAL) < ${balance}
          OR (CAST(token_balance.balance AS REAL) = ${balance} AND post.indexedAt < ${indexedAt})
          OR token_balance.balance IS NULL
        `
      )
    }
  }

  const res = await builder.execute()

  // Filter out posts from users without token balances
  // Skip this filter in local dev (SKIP_TOKEN_HOLDER_CHECK=true)
  const skipCheck = process.env.SKIP_TOKEN_HOLDER_CHECK === 'true'
  const filteredRes = skipCheck
    ? res
    : res.filter(row => row.balance && parseFloat(row.balance) > 0)

  const feed = filteredRes.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = filteredRes.at(-1)
  if (last) {
    const balance = last.balance ?? 'null'
    const ts = new Date(last.indexedAt).getTime()
    cursor = `${balance}_${ts}`
  }

  return {
    cursor,
    feed,
  }
}


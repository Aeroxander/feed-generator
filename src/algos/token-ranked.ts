import { sql } from 'kysely'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'token-ranked'

/**
 * "Top Boosted Posts" feed
 *
 * Only shows posts that have any engagement (boostScore > 0 OR voteScore != 0), ranked by:
 *   score = boostScore (USDC boosted) + voteScore (net CREATE token vote weight * 0.1)
 *
 * boostScore and voteScore are kept up to date by the score-sync background service.
 */
export const handler = async (ctx: AppContext, params: QueryParams) => {
    let builder = ctx.db
        .selectFrom('post')
        .select([
            'post.uri',
            'post.cid',
            'post.indexedAt',
            'post.author',
            'post.boostScore',
            'post.voteScore',
            sql<number>`(post.boostScore + post.voteScore * 0.1)`.as('combinedScore'),
        ])
        .where((eb) => eb.or([
            eb('post.boostScore', '>', 0),
            eb('post.voteScore', '!=', 0),
        ]))
        .orderBy(sql`(post.boostScore + post.voteScore * 0.1)`, 'desc')
        .orderBy('post.indexedAt', 'desc')
        .limit(params.limit)

    if (params.cursor) {
        // cursor format: "<combinedScore>_<indexedAtMs>"
        const [scoreStr, tsStr] = params.cursor.split('_')
        const score = parseFloat(scoreStr)
        const indexedAt = new Date(parseInt(tsStr, 10)).toISOString()
        builder = builder.where(
            sql<boolean>`(post.boostScore + post.voteScore * 0.1) < ${score} OR ((post.boostScore + post.voteScore * 0.1) = ${score} AND post.indexedAt < ${indexedAt})`,
        )
    }

    const res = await builder.execute()

    const feed = res.map((row) => ({
        post: row.uri,
    }))

    let cursor: string | undefined
    const last = res.at(-1)
    if (last) {
        const combinedScore = (last.boostScore ?? 0) + (last.voteScore ?? 0) * 0.1
        const ts = new Date(last.indexedAt).getTime()
        cursor = `${combinedScore}_${ts}`
    }

    return { cursor, feed }
}

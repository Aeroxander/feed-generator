/**
 * Score Sync Service
 *
 * Runs on a schedule to pull boost + vote scores from external services
 * (Ponder for USDC boosts, token vote appview for up/downvote weight)
 * and update the post table's boostScore and voteScore columns.
 *
 * This is what powers the "Top Boosted Posts" ranked feed algo.
 */

import { Database } from '../db'

const PONDER_URL = process.env.PONDER_URL || 'http://localhost:42069'
const TOKEN_VOTE_URL = process.env.TOKEN_VOTE_URL || 'http://localhost:3100'

// How many posts to score in one pass (to avoid huge batches)
const BATCH_SIZE = 100
// Only re-score posts newer than this many days
const SCORE_WINDOW_DAYS = 30

interface PonderBoostEvent {
    postUri: string
    amount: string // bigint string, 6 decimals (USDC)
}

interface TokenVoteResponse {
    uri: string
    upvoteWeight: string // bigint string, 18 decimals
    downvoteWeight: string // bigint string, 18 decimals
}

import { encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem'

export function postUriToContentId(postUri: string): `0x${string}` {
    const utf8 = new TextEncoder().encode(postUri)
    return keccak256(utf8)
}

/** Fetch total USDC boost for a set of post URIs from Ponder */
async function fetchBoostScores(contentIds: string[], contentIdToUri: Map<string, string>): Promise<Map<string, number>> {
    const scores = new Map<string, number>()
    if (contentIds.length === 0) return scores

    try {
        // Ponder GraphQL query for boostEvents
        const query = `
      query GetBoostEvents($contentIds: [String!]!) {
        boostEvents(where: { contentId_in: $contentIds }, limit: 1000) {
          items {
            contentId
            amount
          }
        }
      }
    `
        const res = await fetch(`${PONDER_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { contentIds } }),
        })

        if (!res.ok) return scores

        const data = (await res.json()) as {
            data?: { boostEvents?: { items?: { contentId: string; amount: string }[] } }
        }
        const items = data?.data?.boostEvents?.items ?? []

        // Sum USDC amounts per URI (6 decimal places)
        for (const item of items) {
            const uri = contentIdToUri.get(item.contentId)
            if (!uri) continue
            const usdcAmount = Number(BigInt(item.amount)) / 1e6
            const current = scores.get(uri) ?? 0
            scores.set(uri, current + usdcAmount)
        }
    } catch (err) {
        console.error('[score-sync] Failed to fetch boost scores from Ponder:', err)
    }

    return scores
}

/** Fetch net token vote weight for a single post URI */
async function fetchVoteScore(uri: string): Promise<number> {
    try {
        const params = new URLSearchParams({ uri })
        const res = await fetch(
            `${TOKEN_VOTE_URL}/xrpc/app.creaton.feed.getTokenVotes?${params}`,
        )
        if (!res.ok) return 0

        const data = (await res.json()) as TokenVoteResponse
        const up = BigInt(data.upvoteWeight ?? '0')
        const down = BigInt(data.downvoteWeight ?? '0')
        // Normalize from 18-decimal token units to a float
        return Number(up - down) / 1e18
    } catch {
        return 0
    }
}

/** Main sync function — updates boostScore and voteScore for recent posts */
export async function syncScores(db: Database): Promise<void> {
    const windowStart = new Date(
        Date.now() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    let offset = 0
    let totalUpdated = 0

    while (true) {
        // Fetch recent posts that need scoring
        const posts = await db
            .selectFrom('post')
            .select(['uri'])
            .where('indexedAt', '>=', windowStart)
            .orderBy('indexedAt', 'desc')
            .limit(BATCH_SIZE)
            .offset(offset)
            .execute()

        if (posts.length === 0) break

        const uris = posts.map((p) => p.uri)
        const contentIdToUri = new Map<string, string>()
        const contentIds = uris.map(uri => {
            const cid = postUriToContentId(uri)
            contentIdToUri.set(cid, uri)
            return cid
        })

        // Fetch boost scores in one batch from Ponder
        const boostScores = await fetchBoostScores(contentIds, contentIdToUri)

        // Fetch vote scores one by one (token vote appview doesn't have a batch endpoint yet)
        const voteScores = new Map<string, number>()
        for (const uri of uris) {
            const score = await fetchVoteScore(uri)
            voteScores.set(uri, score)
        }

        // Update each post in the DB
        const now = new Date().toISOString()
        for (const uri of uris) {
            const boostScore = boostScores.get(uri) ?? 0
            const voteScore = voteScores.get(uri) ?? 0

            await db
                .updateTable('post')
                .set({
                    boostScore,
                    voteScore,
                    scoreUpdatedAt: now,
                })
                .where('uri', '=', uri)
                .execute()
        }

        totalUpdated += uris.length
        offset += BATCH_SIZE
    }

    const now = new Date().toISOString()
    console.log(
        `[score-sync] Updated scores for ${totalUpdated} posts at ${now}`,
    )
}

/** Start the score sync loop — runs immediately then every intervalMs */
export function startScoreSyncLoop(
    db: Database,
    intervalMs = 5 * 60 * 1000, // 5 minutes
): NodeJS.Timeout {
    // Run immediately on start
    syncScores(db).catch((err) =>
        console.error('[score-sync] Initial sync failed:', err),
    )

    return setInterval(() => {
        syncScores(db).catch((err) =>
            console.error('[score-sync] Periodic sync failed:', err),
        )
    }, intervalMs)
}

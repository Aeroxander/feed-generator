/**
 * publishFeedLocal.ts
 *
 * Non-interactive script to publish Creaton feed generators to AT Protocol.
 * Reads all config from .env — no prompts. Run with:
 *   yarn ts-node scripts/publishFeedLocal.ts
 *
 * Required .env vars:
 *   FEEDGEN_PUBLISHER_HANDLE   — your Bluesky handle (e.g. alice.bsky.social or alice.bsky.dev)
 *   FEEDGEN_PUBLISHER_PASSWORD — your Bluesky password or App Password
 *   FEEDGEN_PUBLISHER_SERVICE  — (optional) PDS URL, defaults to https://bsky.social
 *   FEEDGEN_SERVICE_DID        — (optional) service DID, defaults to did:web:<FEEDGEN_HOSTNAME>
 *   FEEDGEN_HOSTNAME           — e.g. localhost:3000
 */

import dotenv from 'dotenv'
import { AtpAgent } from '@atproto/api'
import { ids } from '../src/lexicon/lexicons'

dotenv.config()

const FEEDS_TO_PUBLISH = [
    {
        rkey: 'token-ranked',
        displayName: 'Top Boosted',
        description:
            'Posts ranked by USDC boost amount + CREATE token upvotes. The Creaton tournament feed.',
    },
    {
        rkey: 'token-daily',
        displayName: 'Top Holders',
        description:
            'Top posts from $CREATE token holders in the last 24 hours, ranked by token balance.',
    },
]

async function main() {
    const handle = process.env.FEEDGEN_PUBLISHER_HANDLE
    const password = process.env.FEEDGEN_PUBLISHER_PASSWORD
    const service =
        process.env.FEEDGEN_PUBLISHER_SERVICE ?? 'https://bsky.social'
    const hostname = process.env.FEEDGEN_HOSTNAME ?? 'localhost:3000'
    const feedGenDid =
        process.env.FEEDGEN_SERVICE_DID ?? `did:web:${hostname}`

    if (!handle || !password) {
        console.error(
            '❌ Missing FEEDGEN_PUBLISHER_HANDLE or FEEDGEN_PUBLISHER_PASSWORD in .env',
        )
        process.exit(1)
    }

    console.log(`🔑 Logging in as ${handle} on ${service}...`)
    const agent = new AtpAgent({ service })
    await agent.login({ identifier: handle, password })
    const publisherDid = agent.session?.did
    if (!publisherDid) {
        console.error('❌ Login failed — no session DID returned')
        process.exit(1)
    }
    console.log(`✅ Logged in. Publisher DID: ${publisherDid}`)
    console.log(`📡 Feed generator service DID: ${feedGenDid}`)
    console.log()

    for (const feed of FEEDS_TO_PUBLISH) {
        console.log(`📢 Publishing "${feed.displayName}" (rkey: ${feed.rkey})...`)
        await agent.api.com.atproto.repo.putRecord({
            repo: publisherDid,
            collection: ids.AppBskyFeedGenerator,
            rkey: feed.rkey,
            record: {
                did: feedGenDid,
                displayName: feed.displayName,
                description: feed.description,
                createdAt: new Date().toISOString(),
            },
        })
        const feedUri = `at://${publisherDid}/app.bsky.feed.generator/${feed.rkey}`
        console.log(`✅ Published: ${feedUri}`)
    }

    console.log()
    console.log('🎉 All done! Add these to your creaton-app .env:')
    console.log(`EXPO_PUBLIC_FEED_GENERATOR_DID=${publisherDid}`)
    console.log()
    console.log('And update bluesky-token-feed .env:')
    console.log(`FEEDGEN_PUBLISHER_DID=${publisherDid}`)
}

main().catch((err) => {
    console.error('❌ Fatal error:', err)
    process.exit(1)
})

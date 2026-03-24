import { Database } from './db'
import { Tap } from '@creatonproto/tap'
import { TokenHolderService } from './services/token-holder'
import readline from 'readline'

import WebSocket from 'ws'

export class TapSubscription {
    private ws: WebSocket | null = null
    public tapUrl: string
    public tapAdminPassword?: string

    constructor(public db: Database, tapUrl: string, adminPassword?: string) {
        this.tapUrl = tapUrl
        this.tapAdminPassword = adminPassword
    }

    async isTokenHolder(did: string): Promise<boolean> {
        const holderService = new TokenHolderService(this.db)
        return await holderService.isTokenHolder(did)
    }

    async start() {
        const wsUrl = this.tapUrl.replace('http:', 'ws:').replace('https:', 'wss:') + '/channel'
        this.ws = new WebSocket(wsUrl)

        this.ws.on('message', async (data) => {
            try {
                const evt = JSON.parse(data.toString())
                if (evt.type === 'record') {
                    await this.handleRecord(evt.record)
                }
            } catch (err) {
                console.error('[TAP] Failed to parse message', err)
            }
        })

        this.ws.on('error', (err) => console.error('[TAP] Websocket error', err))
        this.ws.on('close', () => console.log('[TAP] Websocket closed'))
    }

    async addRepos(dids: string[]) {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (this.tapAdminPassword) {
                headers['Authorization'] = `Basic ${Buffer.from(`admin:${this.tapAdminPassword}`).toString('base64')}`
            }

            const res = await fetch(`${this.tapUrl}/repos/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ dids })
            })
            if (!res.ok) {
                console.error('[TAP] Failed to add repos:', res.status, await res.text())
            }
        } catch (err) {
            console.error('[TAP] Failed to send addRepos request:', err)
        }
    }

    async handleRecord(evt: any) {
        if (evt.action === 'create' || evt.action === 'update') {
            if (evt.collection === 'app.bsky.feed.post') {
                // We only care about posts from active token holders
                if (process.env.SKIP_TOKEN_HOLDER_CHECK !== 'true') {
                    const isHolder = await this.isTokenHolder(evt.did)
                    if (!isHolder) return
                }
                await this.db.insertInto('post').values({
                    uri: `at://${evt.did}/${evt.collection}/${evt.rkey}`,
                    cid: evt.cid?.toString() || '',
                    author: evt.did,
                    indexedAt: new Date().toISOString(),
                    boostScore: 0,
                    voteScore: 0
                }).onConflict(oc => oc.doNothing()).execute()
            }
            else if (evt.collection === 'app.creaton.feed.tokenVote') {
                const subjectUri = evt.record?.subject?.uri
                if (subjectUri) {
                    await this.db.insertInto('post').values({
                        uri: subjectUri,
                        cid: '',
                        author: subjectUri.split('/')[2],
                        indexedAt: new Date().toISOString(),
                        boostScore: 0,
                        voteScore: 0
                    }).onConflict((oc) => oc.doNothing()).execute()
                }
            }
        } else if (evt.action === 'delete') {
            const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`
            if (evt.collection === 'app.bsky.feed.post') {
                await this.db.deleteFrom('post').where('uri', '=', uri).execute()
            }
            // Can add delete handling for tokenVotes if necessary
        }
    }

    /**
     * Fetches all DIDs from the given PDS/Relay and adds them to TAP
     */
    async syncAllDidsFromPds(pdsUrl: string) {
        console.log(`[TAP] Fetching all DIDs from PDS: ${pdsUrl}`)
        try {
            const response = await fetch(`${pdsUrl}/xrpc/com.atproto.sync.listRepos`)
            if (!response.body) return

            const dids: string[] = []

            // Node.js fetch body is a ReadableStream or similar, use async iterator if possible
            // or just text() parsing
            const text = await response.text()
            console.log(`[TAP] PDS listRepos status: ${response.status}. Received ${text.length} bytes.`)

            try {
                // Try parsing as a single JSON object first (standard XRPC)
                const parsed = JSON.parse(text)
                if (parsed.repos && Array.isArray(parsed.repos)) {
                    for (const repo of parsed.repos) {
                        if (repo.did) dids.push(repo.did)
                    }
                }
            } catch (e) {
                // Fallback to JSONL
                const lines = text.split('\n')
                let parseErrors = 0
                for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                        const parsed = JSON.parse(line)
                        if (parsed.did) dids.push(parsed.did)
                    } catch (err) {
                        parseErrors++
                    }
                }
                if (parseErrors > 0) {
                    console.log(`[TAP] Encountered ${parseErrors} JSON parse errors. First line: ${lines[0].substring(0, 100)}`)
                }
            }

            console.log(`[TAP] Discovered ${dids.length} DIDs from PDS. Subscribing them via TAP...`)

            // Add repos in batches of 1000
            for (let i = 0; i < dids.length; i += 1000) {
                const batch = dids.slice(i, i + 1000)
                await this.addRepos(batch)
            }

            console.log(`[TAP] Successfully subscribed to all ${dids.length} DIDs.`)
        } catch (err) {
            console.error('[TAP] Failed to sync all DIDs from PDS:', err)
        }
    }

    /**
     * Starts a background loop to periodically sync new DIDs from the PDS
     * so that newly created accounts are also tracked by TAP.
     */
    startPeriodicSync(pdsUrl: string, intervalMs: number = 5 * 60 * 1000) {
        setInterval(() => {
            this.syncAllDidsFromPds(pdsUrl).catch(err => {
                console.error('[TAP] Periodic DID sync failed:', err)
            })
        }, intervalMs)
    }
}

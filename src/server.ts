import http from 'http'
import events from 'events'
import express from 'express'
import cors from 'cors'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, Database, migrateToLatest } from './db'
import { TapSubscription } from './tap-subscription'
import { TokenHolderService } from './services/token-holder'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { startScoreSyncLoop } from './services/score-sync'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public tapSub: TapSubscription
  public tokenHolderService: TokenHolderService
  public cfg: Config

  constructor(
    app: express.Application,
    db: Database,
    tapSub: TapSubscription,
    tokenHolderService: TokenHolderService,
    cfg: Config,
  ) {
    this.app = app
    this.db = db
    this.tapSub = tapSub
    this.tokenHolderService = tokenHolderService
    this.cfg = cfg
  }

  static create(cfg: Config) {
    const app = express()
    app.use(cors())
    const db = createDb(cfg.sqliteLocation)
    const tokenHolderService = new TokenHolderService(db)
    const tapSub = new TapSubscription(db, cfg.tapUrl || 'http://localhost:2480', cfg.tapPassword)

    // Wire up events
    tokenHolderService.on('new-holder', async (did: string) => {
      console.log(`[server] New holder discovered, adding to TAP backfill: ${did}`)
      await tapSub.addRepos([did])
    })

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    return new FeedGenerator(app, db, tapSub, tokenHolderService, cfg)
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)

    // Start TAP consumer
    console.log(`[TAP] Starting consumer connecting to ${this.cfg.tapUrl || 'http://localhost:2480'}`)
    this.tapSub.start().catch((err) => console.error('TAP error:', err))

    // Pull all DIDs from the local PDS so TAP doesn't drop their posts
    const pdsUrl = this.cfg.subscriptionEndpoint?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:2583'
    await this.tapSub.syncAllDidsFromPds(pdsUrl)

    // Periodically re-sync every 5 minutes to catch newly created accounts
    this.tapSub.startPeriodicSync(pdsUrl)

    try {
      const holders = await this.db.selectFrom('token_holder').select('did').where('isActive', '=', 1).execute()
      const dids = holders.map(h => h.did)
      if (dids.length > 0) {
        await this.tapSub.addRepos(dids)
      }
    } catch (err) {
      console.error('Failed to init backfill TAP repos', err)
    }

    // Start background score sync loop (updates boostScore + voteScore every 5 min)
    startScoreSyncLoop(this.db)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator

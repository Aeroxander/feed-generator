import dotenv from 'dotenv'
import { createDb, migrateToLatest } from '../src/db'
import { TokenService } from '../src/services/token-service'
import { TokenHolderService } from '../src/services/token-holder'
import { EnsDiscoveryService } from '../src/services/ens-discovery'

/**
 * Script to sync token holder balances from the subgraph or Etherscan,
 * discover DIDs via ENS names, and update the list of token holder DIDs to track
 * Run this periodically (e.g., every hour) via cron
 */
const run = async () => {
  dotenv.config()

  const tokenAddress = process.env.TOKEN_ADDRESS
  const subgraphUrl = process.env.SUBGRAPH_URL
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY
  const sqliteLocation = process.env.FEEDGEN_SQLITE_LOCATION ?? ':memory:'
  
  // Custom domains to try when converting ENS to AT Protocol handles
  // Format: ['social', 'creaton.social', 'yourproject.social']
  const customDomains = process.env.CUSTOM_DOMAINS
    ? process.env.CUSTOM_DOMAINS.split(',')
    : ['social', 'creaton.social']

  if (!tokenAddress) {
    console.error('TOKEN_ADDRESS environment variable is required')
    process.exit(1)
  }

  if (!subgraphUrl && !etherscanApiKey) {
    console.error('Either SUBGRAPH_URL or ETHERSCAN_API_KEY is required')
    process.exit(1)
  }

  console.log('Initializing database...')
  const db = createDb(sqliteLocation)
  await migrateToLatest(db)

  console.log('Initializing services...')
  const tokenService = new TokenService(
    db,
    tokenAddress,
    subgraphUrl,
    etherscanApiKey,
  )
  const tokenHolderService = new TokenHolderService(db)
  const ensDiscoveryService = new EnsDiscoveryService(db)

  try {
    console.log('\n=== Step 1: Syncing token holder balances ===')
    await tokenService.syncTokenHolders()
    
    console.log('\n=== Step 2: Discovering DIDs via ENS ===')
    console.log(`Using domains: ${customDomains.join(', ')}`)
    await ensDiscoveryService.discoverAllUnmappedTokenHolders(customDomains)
    
    console.log('\n=== Step 3: Building token holder DID list ===')
    await tokenHolderService.syncTokenHoldersFromBalances()
    
    const holderCount = await tokenHolderService.getTokenHolderCount()
    console.log(`\n✓ Sync completed! Tracking ${holderCount} token holder DIDs`)
  } catch (error) {
    console.error('Error syncing token holders:', error)
    process.exit(1)
  }

  await db.destroy()
  console.log('Database closed')
}

run()
  .then(() => {
    console.log('Sync completed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Sync failed:', err)
    process.exit(1)
  })

import dotenv from 'dotenv'
import { createDb, migrateToLatest } from '../src/db'
import { DidResolverService } from '../src/services/did-resolver'

/**
 * Script to manually resolve and cache DID to wallet mappings
 * Usage: yarn resolveDids did:plc:abc123 did:plc:def456 ...
 */
const run = async () => {
  dotenv.config()

  const sqliteLocation = process.env.FEEDGEN_SQLITE_LOCATION ?? ':memory:'
  const didsToResolve = process.argv.slice(2)

  if (didsToResolve.length === 0) {
    console.log('Usage: yarn resolveDids <did1> <did2> ...')
    console.log('Example: yarn resolveDids did:plc:abc123 did:plc:def456')
    process.exit(0)
  }

  console.log(`Resolving ${didsToResolve.length} DIDs...`)
  const db = createDb(sqliteLocation)
  await migrateToLatest(db)

  const resolver = new DidResolverService(db)

  const results = await resolver.batchResolveEthereumAddresses(didsToResolve)

  console.log('\nResults:')
  console.log('========================================')
  for (const [did, address] of results.entries()) {
    if (address) {
      console.log(`✓ ${did}`)
      console.log(`  → ${address}`)
    } else {
      console.log(`✗ ${did}`)
      console.log(`  → No Ethereum address found`)
    }
    console.log('')
  }

  const successCount = Array.from(results.values()).filter(Boolean).length
  console.log(`Resolved ${successCount}/${didsToResolve.length} DIDs successfully`)

  await db.destroy()
}

run()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })

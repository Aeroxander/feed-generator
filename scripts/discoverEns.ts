import dotenv from 'dotenv'
import { createDb, migrateToLatest } from '../src/db'
import { EnsDiscoveryService } from '../src/services/ens-discovery'

/**
 * Script to discover DIDs via ENS for specific wallet addresses
 * Usage: yarn discoverEns <address1> <address2> ...
 * Example: yarn discoverEns 0x1234... 0x5678...
 */
const run = async () => {
  dotenv.config()

  const sqliteLocation = process.env.FEEDGEN_SQLITE_LOCATION ?? ':memory:'
  const addresses = process.argv.slice(2)

  const customDomains = process.env.CUSTOM_DOMAINS
    ? process.env.CUSTOM_DOMAINS.split(',')
    : ['social', 'creaton.social']

  if (addresses.length === 0) {
    console.log('Usage: yarn discoverEns <address1> <address2> ...')
    console.log('Example: yarn discoverEns 0x1234567890abcdef 0x9876543210fedcba')
    console.log('\nOr use without arguments to discover all unmapped token holders:')
    console.log('yarn discoverEns --all')
    process.exit(0)
  }

  console.log('Initializing database...')
  const db = createDb(sqliteLocation)
  await migrateToLatest(db)

  const ensDiscoveryService = new EnsDiscoveryService(db)

  try {
    if (addresses[0] === '--all') {
      console.log(`\nDiscovering DIDs for all unmapped token holders...`)
      console.log(`Using domains: ${customDomains.join(', ')}\n`)
      await ensDiscoveryService.discoverAllUnmappedTokenHolders(customDomains)
    } else {
      console.log(`\nDiscovering DIDs for ${addresses.length} addresses...`)
      console.log(`Using domains: ${customDomains.join(', ')}\n`)

      const results = await ensDiscoveryService.batchDiscoverDids(addresses, customDomains)

      console.log('\n=== Results ===')
      for (const address of addresses) {
        const result = results.get(address)
        if (result) {
          console.log(`\n✓ ${address}`)
          console.log(`  ENS: ${result.ensName}`)
          console.log(`  Handle: ${result.handle}`)
          console.log(`  DID: ${result.did}`)
        } else {
          console.log(`\n✗ ${address}`)
          console.log(`  No ENS or matching handle found`)
        }
      }

      console.log(`\n\nFound: ${results.size}/${addresses.length}`)
    }
  } catch (error) {
    console.error('Error discovering DIDs:', error)
    process.exit(1)
  }

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

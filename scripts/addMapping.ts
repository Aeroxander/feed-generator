import dotenv from 'dotenv'
import { createDb, migrateToLatest } from '../src/db'
import { WalletMappingService } from '../src/services/wallet-mapping'
import { TokenHolderService } from '../src/services/token-holder'

/**
 * Script to manually add DID to wallet mappings
 * This is useful for token holders who haven't linked their wallet in their DID document
 * 
 * Usage: yarn addMapping <did> <walletAddress>
 * Example: yarn addMapping did:plc:abc123 0x1234567890abcdef
 */
const run = async () => {
  dotenv.config()

  const sqliteLocation = process.env.FEEDGEN_SQLITE_LOCATION ?? ':memory:'
  const args = process.argv.slice(2)

  if (args.length !== 2) {
    console.log('Usage: yarn addMapping <did> <walletAddress>')
    console.log('Example: yarn addMapping did:plc:abc123 0x1234567890abcdef1234567890abcdef12345678')
    process.exit(0)
  }

  const [did, walletAddress] = args

  if (!did.startsWith('did:')) {
    console.error('Error: DID must start with "did:"')
    process.exit(1)
  }

  if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
    console.error('Error: Wallet address must be a valid Ethereum address (0x...)')
    process.exit(1)
  }

  console.log('Initializing database...')
  const db = createDb(sqliteLocation)
  await migrateToLatest(db)

  const mappingService = new WalletMappingService(db)
  const holderService = new TokenHolderService(db)

  try {
    console.log(`\nAdding mapping:`)
    console.log(`  DID: ${did}`)
    console.log(`  Wallet: ${walletAddress}`)

    await mappingService.addMapping(did, walletAddress)

    // Check if this wallet has tokens
    const balance = await db
      .selectFrom('token_balance')
      .selectAll()
      .where('walletAddress', '=', walletAddress.toLowerCase())
      .executeTakeFirst()

    if (balance && parseFloat(balance.balance) > 0) {
      console.log(`\n✓ This wallet has ${balance.balance} tokens`)
      console.log(`  Adding to token holder list...`)
      await holderService.addTokenHolder(did)
      console.log(`✓ DID added to token holder list`)
    } else {
      console.log(`\n⚠ This wallet has no token balance`)
      console.log(`  The user's posts will not appear in the feed until they acquire tokens`)
    }

    console.log('\n✓ Mapping added successfully!')
  } catch (error) {
    console.error('Error adding mapping:', error)
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

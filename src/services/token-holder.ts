import { Database } from '../db'
import { DidResolverService } from './did-resolver'
import { EventEmitter } from 'events'

/**
 * Service for managing the list of token holder DIDs we should track
 */
export class TokenHolderService extends EventEmitter {
  private didResolver: DidResolverService

  constructor(private db: Database) {
    super()
    this.didResolver = new DidResolverService(db)
  }

  /**
   * Add a DID to the token holder list
   */
  async addTokenHolder(did: string): Promise<void> {
    const timestamp = new Date().toISOString()

    await this.db
      .insertInto('token_holder')
      .values({
        did,
        isActive: 1,
        lastChecked: timestamp,
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          isActive: 1,
          lastChecked: timestamp,
        }),
      )
      .execute()

    // Emit event so subscribers (like TAP) can start backfilling them
    this.emit('new-holder', did)
  }

  /**
   * Remove a DID from the token holder list (mark as inactive)
   */
  async removeTokenHolder(did: string): Promise<void> {
    const timestamp = new Date().toISOString()

    await this.db
      .updateTable('token_holder')
      .set({
        isActive: 0,
        lastChecked: timestamp,
      })
      .where('did', '=', did)
      .execute()
  }

  /**
   * Check if a DID is in the active token holder list
   */
  async isTokenHolder(did: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('token_holder')
      .selectAll()
      .where('did', '=', did)
      .where('isActive', '=', 1)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Get all active token holder DIDs
   */
  async getAllTokenHolderDids(): Promise<string[]> {
    const results = await this.db
      .selectFrom('token_holder')
      .select('did')
      .where('isActive', '=', 1)
      .execute()

    return results.map((r) => r.did)
  }

  /**
   * Get count of active token holders
   */
  async getTokenHolderCount(): Promise<number> {
    const result = await this.db
      .selectFrom('token_holder')
      .select((eb) => eb.fn.count('did').as('count'))
      .where('isActive', '=', 1)
      .executeTakeFirst()

    return Number(result?.count ?? 0)
  }

  /**
   * Sync token holders: For each wallet with balance > 0, try to find their DID
   * This builds the mapping from token holders (wallets) to DIDs
   */
  async syncTokenHoldersFromBalances(): Promise<void> {
    console.log('Syncing token holder DIDs from balances...')

    // Get all wallets with non-zero balances
    const balances = await this.db
      .selectFrom('token_balance')
      .selectAll()
      .where('balance', '>', '0')
      .execute()

    console.log(`Found ${balances.length} wallets with token balances`)

    let foundDids = 0
    let notFoundDids = 0

    for (const balance of balances) {
      // Check if we already have a mapping
      const existingMapping = await this.db
        .selectFrom('wallet_mapping')
        .selectAll()
        .where('walletAddress', '=', balance.walletAddress)
        .executeTakeFirst()

      if (existingMapping) {
        // We have a DID for this wallet, add to token holder list
        await this.addTokenHolder(existingMapping.did)
        foundDids++
        console.log(`✓ Found DID for ${balance.walletAddress}: ${existingMapping.did}`)
      } else {
        // No DID mapping yet - this wallet holder hasn't linked their account
        // They won't appear in the feed until they link their DID
        notFoundDids++
        console.log(`✗ No DID found for ${balance.walletAddress}`)
      }
    }

    console.log(`\nSync complete:`)
    console.log(`  - ${foundDids} token holders with linked DIDs`)
    console.log(`  - ${notFoundDids} token holders without linked DIDs (won't appear in feed)`)

    // Clean up: mark DIDs as inactive if they no longer have balances
    await this.deactivateZeroBalanceHolders()
  }

  /**
   * Mark token holders as inactive if their balance is now 0
   */
  private async deactivateZeroBalanceHolders(): Promise<void> {
    const activeHolders = await this.getAllTokenHolderDids()

    for (const did of activeHolders) {
      const address = await this.didResolver.getEthereumAddressForDid(did)
      if (!address) {
        await this.removeTokenHolder(did)
        continue
      }

      const balance = await this.db
        .selectFrom('token_balance')
        .selectAll()
        .where('walletAddress', '=', address)
        .executeTakeFirst()

      if (!balance || parseFloat(balance.balance) <= 0) {
        console.log(`Deactivating ${did} (zero balance)`)
        await this.removeTokenHolder(did)
      }
    }
  }

  /**
   * When we encounter a post, check if the author's DID should be tracked
   * This is called during normal operation to discover new token holder DIDs
   */
  async checkAndAddIfTokenHolder(did: string): Promise<boolean> {
    // First check if already in the list
    const isHolder = await this.isTokenHolder(did)
    if (isHolder) return true

    // Check if this DID has a wallet with tokens
    const hasTokens = await this.didResolver.isTokenHolder(did)
    if (hasTokens) {
      console.log(`Discovered new token holder: ${did}`)
      await this.addTokenHolder(did)
      return true
    }

    return false
  }
}

import { Database } from '../db'

/**
 * Service for managing DID to wallet address mappings
 * 
 * In a production system, you would verify the wallet ownership
 * through signature verification or other attestation methods.
 */
export class WalletMappingService {
  constructor(private db: Database) {}

  /**
   * Add or update a DID to wallet mapping
   */
  async addMapping(did: string, walletAddress: string): Promise<void> {
    const timestamp = new Date().toISOString()

    await this.db
      .insertInto('wallet_mapping')
      .values({
        did,
        walletAddress: walletAddress.toLowerCase(),
        verifiedAt: timestamp,
        lastUpdated: timestamp,
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({
          walletAddress: walletAddress.toLowerCase(),
          lastUpdated: timestamp,
        }),
      )
      .execute()

    console.log(`Added mapping: ${did} -> ${walletAddress}`)
  }

  /**
   * Get wallet address for a DID
   */
  async getWalletForDid(did: string): Promise<string | null> {
    const result = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    return result?.walletAddress || null
  }

  /**
   * Get DID for a wallet address
   */
  async getDidForWallet(walletAddress: string): Promise<string | null> {
    const result = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('walletAddress', '=', walletAddress.toLowerCase())
      .executeTakeFirst()

    return result?.did || null
  }

  /**
   * Check if a DID has a wallet mapping
   */
  async hasMapping(did: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    return !!result
  }

  /**
   * Remove a mapping
   */
  async removeMapping(did: string): Promise<void> {
    await this.db
      .deleteFrom('wallet_mapping')
      .where('did', '=', did)
      .execute()

    console.log(`Removed mapping for DID: ${did}`)
  }

  /**
   * Get all mappings (for admin/debug purposes)
   */
  async getAllMappings(): Promise<Array<{ did: string; walletAddress: string }>> {
    const results = await this.db
      .selectFrom('wallet_mapping')
      .select(['did', 'walletAddress'])
      .execute()

    return results
  }

  /**
   * Batch add mappings
   */
  async addMappingsBatch(
    mappings: Array<{ did: string; walletAddress: string }>,
  ): Promise<void> {
    const timestamp = new Date().toISOString()

    for (const mapping of mappings) {
      try {
        await this.addMapping(mapping.did, mapping.walletAddress)
      } catch (error) {
        console.error(
          `Error adding mapping for ${mapping.did}:`,
          error,
        )
      }
    }

    console.log(`Added ${mappings.length} mappings`)
  }
}

import axios from 'axios'
import { Database } from '../db'

/**
 * Service for discovering DIDs via ENS names
 * This bridges token holders (wallet addresses) to DIDs via ENS
 */
export class EnsDiscoveryService {
  private ensGraphUrl = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'
  private blueskyApiUrl = 'https://bsky.social/xrpc'

  constructor(private db: Database) {}

  /**
   * Get ENS name for an Ethereum address using The Graph
   */
  async getEnsNameForAddress(address: string): Promise<string | null> {
    const query = `
      query GetENSName($address: String!) {
        domains(where: { resolvedAddress: $address }, first: 1) {
          name
        }
      }
    `

    try {
      const response = await axios.post(this.ensGraphUrl, {
        query,
        variables: {
          address: address.toLowerCase(),
        },
      })

      const domains = response.data?.data?.domains
      if (domains && domains.length > 0) {
        return domains[0].name
      }
      return null
    } catch (error) {
      console.error(`Error fetching ENS for ${address}:`, error)
      return null
    }
  }

  /**
   * Convert ENS name to potential AT Protocol handle
   * Example: example.creaton.eth → example.creaton.social
   */
  convertEnsToAtHandle(ensName: string, targetDomain: string = 'social'): string {
    // Remove .eth suffix and add the target domain
    if (ensName.endsWith('.eth')) {
      const baseName = ensName.slice(0, -4) // Remove '.eth'
      return `${baseName}.${targetDomain}`
    }
    // If no .eth suffix, just append the target domain
    return `${ensName}.${targetDomain}`
  }

  /**
   * Resolve an AT Protocol handle to a DID
   */
  async resolveHandleToDid(handle: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.blueskyApiUrl}/com.atproto.identity.resolveHandle`,
        {
          params: { handle },
        }
      )

      if (response.data?.did) {
        return response.data.did
      }
      return null
    } catch (error) {
      // Handle not found or other error
      return null
    }
  }

  /**
   * Discover DID for a wallet address using ENS as a bridge
   * Returns the DID if found, null otherwise
   */
  async discoverDidViaEns(
    walletAddress: string,
    customDomains: string[] = ['social', 'creaton.social']
  ): Promise<{ did: string | null; ensName: string | null; handle: string | null }> {
    console.log(`Discovering DID for wallet ${walletAddress}...`)

    // Step 1: Get ENS name for the address
    const ensName = await this.getEnsNameForAddress(walletAddress)
    if (!ensName) {
      console.log(`  ✗ No ENS name found`)
      return { did: null, ensName: null, handle: null }
    }

    console.log(`  ✓ Found ENS name: ${ensName}`)

    // Step 2: Try converting ENS to AT Protocol handles with various domains
    for (const domain of customDomains) {
      const potentialHandle = this.convertEnsToAtHandle(ensName, domain)
      console.log(`  Trying handle: ${potentialHandle}`)

      // Step 3: Try to resolve the handle to a DID
      const did = await this.resolveHandleToDid(potentialHandle)
      if (did) {
        console.log(`  ✓ Found DID: ${did}`)
        return { did, ensName, handle: potentialHandle }
      }
    }

    console.log(`  ✗ No matching AT Protocol handle found`)
    return { did: null, ensName, handle: null }
  }

  /**
   * Batch discover DIDs for multiple wallet addresses
   */
  async batchDiscoverDids(
    walletAddresses: string[],
    customDomains: string[] = ['social', 'creaton.social']
  ): Promise<Map<string, { did: string; ensName: string; handle: string }>> {
    const results = new Map<string, { did: string; ensName: string; handle: string }>()

    for (const address of walletAddresses) {
      const discovery = await this.discoverDidViaEns(address, customDomains)
      
      if (discovery.did && discovery.ensName && discovery.handle) {
        results.set(address, {
          did: discovery.did,
          ensName: discovery.ensName,
          handle: discovery.handle,
        })

        // Store the mapping in the database
        const timestamp = new Date().toISOString()
        await this.db
          .insertInto('wallet_mapping')
          .values({
            did: discovery.did,
            walletAddress: address.toLowerCase(),
            verifiedAt: timestamp,
            lastUpdated: timestamp,
          })
          .onConflict((oc) =>
            oc.column('did').doUpdateSet({
              walletAddress: address.toLowerCase(),
              lastUpdated: timestamp,
            })
          )
          .execute()
      }

      // Rate limiting: wait between requests
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    return results
  }

  /**
   * Get all token holder addresses that don't have DID mappings yet
   */
  async getUnmappedTokenHolders(): Promise<string[]> {
    const balances = await this.db
      .selectFrom('token_balance')
      .select('walletAddress')
      .where('balance', '>', '0')
      .execute()

    const unmapped: string[] = []

    for (const balance of balances) {
      const mapping = await this.db
        .selectFrom('wallet_mapping')
        .selectAll()
        .where('walletAddress', '=', balance.walletAddress)
        .executeTakeFirst()

      if (!mapping) {
        unmapped.push(balance.walletAddress)
      }
    }

    return unmapped
  }

  /**
   * Run ENS discovery for all unmapped token holders
   */
  async discoverAllUnmappedTokenHolders(
    customDomains: string[] = ['social', 'creaton.social']
  ): Promise<void> {
    console.log('\n=== ENS Discovery Process ===\n')

    const unmapped = await this.getUnmappedTokenHolders()
    console.log(`Found ${unmapped.length} token holders without DID mappings\n`)

    if (unmapped.length === 0) {
      console.log('All token holders are already mapped!')
      return
    }

    const results = await this.batchDiscoverDids(unmapped, customDomains)

    console.log('\n=== Discovery Results ===')
    console.log(`✓ Found DIDs: ${results.size}`)
    console.log(`✗ Not found: ${unmapped.length - results.size}`)

    if (results.size > 0) {
      console.log('\nDiscovered mappings:')
      for (const [address, info] of results.entries()) {
        console.log(`  ${address}`)
        console.log(`    ENS: ${info.ensName}`)
        console.log(`    Handle: ${info.handle}`)
        console.log(`    DID: ${info.did}`)
      }
    }
  }
}

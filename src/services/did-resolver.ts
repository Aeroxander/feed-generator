import { AtpAgent } from '@atproto/api'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { Database } from '../db'

const ADDRESS_CONTROL_COLLECTION = 'club.stellz.evm.addressControl'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddressControlRecord {
  $type: string
  /** The EVM address stored as ATP bytes: { $bytes: '<base64>' } */
  address: { $bytes: string }
  alsoOn?: number[]
  signature: { $bytes: string }
  siwe: {
    domain: string
    address: string
    statement: string
    uri: string
    version: string
    chainId: number
    nonce: string
    issuedAt: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToHex(b64: string): string {
  const binary = atob(b64)
  let hex = '0x'
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Service for resolving the Ethereum address linked to a Bluesky DID via
 * the `club.stellz.evm.addressControl` ATP record (written by LinkWalletDialog).
 *
 * This replaces the old PLC-directory `alsoKnownAs` approach.
 */
export class DidResolverService {
  private didResolver: DidResolver
  /** DID → hex wallet address (or null = no record found) */
  private cache: Map<string, string | null> = new Map()

  constructor(private db: Database) {
    this.didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache: new MemoryCache(),
    })
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Return the hex wallet address linked to `did`, or null if the user has
   * not linked a wallet via the addressControl lexicon.
   *
   * Checks (in order): in-memory cache → DB cache → live ATP repo fetch.
   */
  async getEthereumAddressForDid(did: string): Promise<string | null> {
    // 1. In-memory cache
    if (this.cache.has(did)) {
      return this.cache.get(did) ?? null
    }

    // 2. DB cache (wallet_mapping table)
    const dbMapping = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    if (dbMapping) {
      this.cache.set(did, dbMapping.walletAddress)
      return dbMapping.walletAddress
    }

    // 3. Live fetch from the DID's PDS
    const address = await this.fetchAddressFromAtpRecord(did)

    if (address) {
      const timestamp = new Date().toISOString()
      await this.db
        .insertInto('wallet_mapping')
        .values({ did, walletAddress: address, verifiedAt: timestamp, lastUpdated: timestamp })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({ walletAddress: address, lastUpdated: timestamp }),
        )
        .execute()
    }

    this.cache.set(did, address)
    return address
  }

  /**
   * Batch-resolve wallet addresses for a list of DIDs.
   */
  async batchResolveEthereumAddresses(
    dids: string[],
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>()
    for (const did of dids) {
      const address = await this.getEthereumAddressForDid(did)
      results.set(did, address)
      // Gentle rate-limiting between PDS calls
      await new Promise((r) => setTimeout(r, 100))
    }
    return results
  }

  /**
   * Check if `did` has a linked wallet with a non-zero token balance.
   */
  async isTokenHolder(did: string): Promise<boolean> {
    const address = await this.getEthereumAddressForDid(did)
    if (!address) return false

    const balance = await this.db
      .selectFrom('token_balance')
      .selectAll()
      .where('walletAddress', '=', address)
      .executeTakeFirst()

    return balance ? parseFloat(balance.balance) > 0 : false
  }

  /** Reverse lookup: wallet address → DID (DB only). */
  async getDidForEthereumAddress(ethAddress: string): Promise<string | null> {
    const normalizedAddress = ethAddress.toLowerCase()
    const dbMapping = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('walletAddress', '=', normalizedAddress)
      .executeTakeFirst()
    return dbMapping?.did ?? null
  }

  clearCache(): void {
    this.cache.clear()
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolve the DID document → PDS service endpoint → fetch
   * `club.stellz.evm.addressControl` records from the user's repo.
   *
   * Returns the lowercase hex wallet address (e.g. `0xabc...`) or null.
   */
  private async fetchAddressFromAtpRecord(did: string): Promise<string | null> {
    try {
      // Step 1: resolve DID → PDS endpoint
      const pdsUrl = await this.resolvePdsUrl(did)
      if (!pdsUrl) {
        console.warn(`[DidResolver] No PDS URL found for ${did}`)
        return null
      }

      // Step 2: list addressControl records from that PDS
      const agent = new AtpAgent({ service: pdsUrl })
      const res = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: ADDRESS_CONTROL_COLLECTION,
        limit: 1,
      })

      const records = res.data.records
      if (!records || records.length === 0) {
        return null
      }

      // Step 3: parse the address bytes back to a hex string
      const record = records[0].value as AddressControlRecord

      // Prefer the inline `siwe.address` field (already a hex string, no decoding needed)
      if (record.siwe?.address?.startsWith('0x')) {
        return record.siwe.address.toLowerCase()
      }

      // Fallback: decode from the raw $bytes field
      if (record.address?.$bytes) {
        return base64ToHex(record.address.$bytes).toLowerCase()
      }

      console.warn(`[DidResolver] addressControl record for ${did} has no parseable address`)
      return null
    } catch (err: any) {
      // 400/404 = user has no such record — not an error worth logging noisily
      if (err?.status === 400 || err?.status === 404) {
        return null
      }
      console.error(`[DidResolver] Error fetching addressControl for ${did}:`, err?.message ?? err)
      return null
    }
  }

  /**
   * Use @atproto/identity's DidResolver to find the user's PDS HTTP endpoint.
   */
  private async resolvePdsUrl(did: string): Promise<string | null> {
    try {
      const didDoc = await this.didResolver.resolve(did)
      if (!didDoc) return null

      const services: any[] = (didDoc as any).service ?? []
      const atpPds = services.find(
        (s: any) =>
          s.id === '#atproto_pds' ||
          s.type === 'AtprotoPersonalDataServer',
      )
      return atpPds?.serviceEndpoint ?? null
    } catch {
      return null
    }
  }
}

import { GraphQLClient } from 'graphql-request'
import axios from 'axios'
import { Database } from '../db'
import { gql } from 'graphql-request'

export interface TokenHolderData {
  address: string
  balance: string
}

export class TokenService {
  private graphqlClient: GraphQLClient | null = null
  private etherscanApiKey: string | null = null
  private tokenAddress: string
  private db: Database

  constructor(
    db: Database,
    tokenAddress: string,
    subgraphUrl?: string,
    etherscanApiKey?: string,
  ) {
    this.db = db
    this.tokenAddress = tokenAddress
    if (subgraphUrl) {
      this.graphqlClient = new GraphQLClient(subgraphUrl)
    }
    if (etherscanApiKey) {
      this.etherscanApiKey = etherscanApiKey
    }
  }

  /**
   * Fetch token holders from GraphQL subgraph
   */
  async fetchTokenHoldersFromSubgraph(): Promise<TokenHolderData[]> {
    if (!this.graphqlClient) {
      throw new Error('GraphQL client not configured')
    }

    const query = gql`
      query GetTokenHolders($tokenAddress: String!) {
        reputationToken(id: $tokenAddress) {
          holders {
            user
            netReputation
          }
        }
      }
    `

    try {
      const data: any = await this.graphqlClient.request(query, {
        tokenAddress: this.tokenAddress.toLowerCase(),
      })

      if (!data.reputationToken?.holders) {
        return []
      }

      return data.reputationToken.holders.map((holder: any) => ({
        address: holder.user,
        balance: holder.netReputation || '0',
      }))
    } catch (error) {
      console.error('Error fetching from subgraph:', error)
      throw error
    }
  }

  /**
   * Fetch token holders from Etherscan API
   * Note: This is a fallback method. Etherscan doesn't directly provide holder balances
   * in bulk, so you might need to query individual addresses or use a different approach
   */
  async fetchTokenHoldersFromEtherscan(
    addresses: string[],
  ): Promise<TokenHolderData[]> {
    if (!this.etherscanApiKey) {
      throw new Error('Etherscan API key not configured')
    }

    const holders: TokenHolderData[] = []

    // Fetch balances in batches
    const batchSize = 20
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)
      const addressList = batch.join(',')

      try {
        const response = await axios.get(
          'https://api.etherscan.io/api',
          {
            params: {
              module: 'account',
              action: 'tokenbalance',
              contractaddress: this.tokenAddress,
              address: addressList,
              tag: 'latest',
              apikey: this.etherscanApiKey,
            },
          },
        )

        if (response.data.status === '1') {
          const balance = response.data.result
          for (let j = 0; j < batch.length; j++) {
            holders.push({
              address: batch[j],
              balance: balance,
            })
          }
        }
      } catch (error) {
        console.error('Error fetching from Etherscan:', error)
      }

      // Rate limiting: wait between batches
      if (i + batchSize < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return holders
  }

  /**
   * Update token balances in the database
   */
  async updateTokenBalances(holders: TokenHolderData[]): Promise<void> {
    const timestamp = new Date().toISOString()

    for (const holder of holders) {
      try {
        await this.db
          .insertInto('token_balance')
          .values({
            walletAddress: holder.address.toLowerCase(),
            balance: holder.balance,
            lastUpdated: timestamp,
          })
          .onConflict((oc) =>
            oc.column('walletAddress').doUpdateSet({
              balance: holder.balance,
              lastUpdated: timestamp,
            }),
          )
          .execute()
      } catch (error) {
        console.error(
          `Error updating balance for ${holder.address}:`,
          error,
        )
      }
    }

    console.log(`Updated ${holders.length} token balances`)
  }

  /**
   * Sync token holders from configured source
   */
  async syncTokenHolders(): Promise<void> {
    console.log('Starting token holder sync...')

    try {
      let holders: TokenHolderData[] = []

      // Try subgraph first
      if (this.graphqlClient) {
        console.log('Fetching from subgraph...')
        holders = await this.fetchTokenHoldersFromSubgraph()
      } else if (this.etherscanApiKey) {
        // Fallback to Etherscan
        console.log('Fetching from Etherscan...')
        // Note: You'll need to maintain a list of known addresses
        // or use events to discover holders
        console.warn(
          'Etherscan method requires known addresses. Consider using subgraph.',
        )
      } else {
        throw new Error('No data source configured')
      }

      if (holders.length > 0) {
        await this.updateTokenBalances(holders)
        console.log('Token holder sync completed successfully')
      } else {
        console.log('No holders found')
      }
    } catch (error) {
      console.error('Error syncing token holders:', error)
      throw error
    }
  }

  /**
   * Get token balance for a specific wallet
   */
  async getTokenBalance(walletAddress: string): Promise<string | null> {
    const result = await this.db
      .selectFrom('token_balance')
      .selectAll()
      .where('walletAddress', '=', walletAddress.toLowerCase())
      .executeTakeFirst()

    return result?.balance || null
  }

  /**
   * Get token balance for a DID (via wallet mapping)
   */
  async getTokenBalanceForDid(did: string): Promise<string | null> {
    const mapping = await this.db
      .selectFrom('wallet_mapping')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    if (!mapping) {
      return null
    }

    return this.getTokenBalance(mapping.walletAddress)
  }
}

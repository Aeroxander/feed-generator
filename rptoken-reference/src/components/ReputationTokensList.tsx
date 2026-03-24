import { useEffect, useState } from 'react'
import { graphqlClient } from '../graphql/client'
import { GET_ALL_REPUTATION_TOKENS } from '../graphql/queries'

interface ReputationToken {
  id: string
  name: string
  symbol: string
  reputationToken: string
  locker: string
  creator: string
  deployedAt: string
  totalLocked: string
  totalUpvotesMinted: string
  totalDownvotesMinted: string
  totalHolders: string
}

interface QueryResponse {
  reputationTokenDeployments: ReputationToken[]
}

export function ReputationTokensList() {
  const [tokens, setTokens] = useState<ReputationToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
      async function fetchTokens() {
      try {
        setLoading(true)
        const data = await graphqlClient.request<QueryResponse>(GET_ALL_REPUTATION_TOKENS)
        setTokens(data.reputationTokenDeployments)
        setError(null)
      } catch (err) {
        console.error('Error fetching tokens:', err)
        setError('Failed to load reputation tokens')
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString()
  }

  const formatAmount = (amount: string) => {
    return (BigInt(amount) / BigInt(10 ** 18)).toString()
  }

  if (loading) {
    return <div style={styles.loading}>Loading reputation tokens...</div>
  }

  if (error) {
    return <div style={styles.error}>{error}</div>
  }

  if (tokens.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No reputation tokens found. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Deployed Reputation Tokens</h2>
      
      <div style={styles.grid}>
        {tokens.map((token) => (
          <div key={token.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.tokenName}>{token.name}</h3>
              <span style={styles.symbol}>{token.symbol}</span>
            </div>
            
            <div style={styles.stats}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Total Upvotes</span>
                <span style={styles.statValue}>
                  {formatAmount(token.totalUpvotesMinted)}
                </span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Total Downvotes</span>
                <span style={styles.statValue}>
                  {formatAmount(token.totalDownvotesMinted)}
                </span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Total Locked</span>
                <span style={styles.statValue}>
                  {formatAmount(token.totalLocked)}
                </span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Holders</span>
                <span style={styles.statValue}>
                  {token.totalHolders}
                </span>
              </div>
            </div>

            <div style={styles.info}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Token Address:</span>
                <code style={styles.infoValue}>{formatAddress(token.reputationToken)}</code>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Locker:</span>
                <code style={styles.infoValue}>{formatAddress(token.locker)}</code>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Creator:</span>
                <code style={styles.infoValue}>{formatAddress(token.creator)}</code>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Deployed:</span>
                <span style={styles.infoValue}>{formatDate(token.deployedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    marginTop: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  },
  error: {
    padding: '16px',
    background: '#fee',
    color: '#c33',
    borderRadius: '4px',
    textAlign: 'center' as const,
  },
  empty: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #eee',
  },
  tokenName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
  },
  symbol: {
    padding: '4px 8px',
    background: '#0070f3',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '16px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0070f3',
  },
  info: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  infoLabel: {
    color: '#666',
  },
  infoValue: {
    fontWeight: '500',
  },
}

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { graphqlClient } from '../graphql/client'
import { GET_USER_REPUTATION } from '../graphql/queries'

interface ReputationBalance {
  id: string
  reputationToken: {
    id: string
    name: string
    symbol: string
    address: string
  }
  upvotes: string
  downvotes: string
  netReputation: string
}

interface Lock {
  id: string
  locker: {
    id: string
    reputationToken: {
      name: string
      symbol: string
    }
  }
  totalLocked: string
  reputationMinted: string
  lastClaimTime: string
}

interface UserData {
  user: {
    id: string
    address: string
    reputationBalances: ReputationBalance[]
    locks: Lock[]
  } | null
}

export function UserReputation() {
  const { address, isConnected } = useAccount()
  const [userData, setUserData] = useState<UserData['user'] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchUserData() {
      if (!address) return

      try {
        setLoading(true)
        const data = await graphqlClient.request<UserData>(GET_USER_REPUTATION, {
          userId: address.toLowerCase(),
        })
        setUserData(data.user)
      } catch (err) {
        console.error('Error fetching user data:', err)
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    if (isConnected && address) {
      fetchUserData()
    }
  }, [address, isConnected])

  if (!isConnected) {
    return (
      <div style={styles.placeholder}>
        <p>Connect your wallet to view your reputation</p>
      </div>
    )
  }

  if (loading) {
    return <div style={styles.loading}>Loading your reputation...</div>
  }

  if (!userData || (userData.reputationBalances.length === 0 && userData.locks.length === 0)) {
    return (
      <div style={styles.empty}>
        <p>You don't have any reputation yet. Start by locking tokens!</p>
      </div>
    )
  }

  const formatAmount = (amount: string) => {
    return (BigInt(amount) / BigInt(10 ** 18)).toString()
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Your Reputation</h2>

      {userData.reputationBalances.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Reputation Balances</h3>
          <div style={styles.grid}>
            {userData.reputationBalances.map((balance) => (
              <div key={balance.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.tokenName}>{balance.reputationToken.name}</span>
                  <span style={styles.symbol}>{balance.reputationToken.symbol}</span>
                </div>
                <div style={styles.balances}>
                  <div style={styles.balanceItem}>
                    <span style={styles.balanceLabel}>Upvotes</span>
                    <span style={{ ...styles.balanceValue, color: '#4caf50' }}>
                      +{formatAmount(balance.upvotes)}
                    </span>
                  </div>
                  <div style={styles.balanceItem}>
                    <span style={styles.balanceLabel}>Downvotes</span>
                    <span style={{ ...styles.balanceValue, color: '#f44336' }}>
                      -{formatAmount(balance.downvotes)}
                    </span>
                  </div>
                  <div style={styles.balanceItem}>
                    <span style={styles.balanceLabel}>Net Reputation</span>
                    <span style={{ ...styles.balanceValue, color: '#0070f3', fontSize: '24px' }}>
                      {formatAmount(balance.netReputation)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {userData.locks.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Your Locks</h3>
          <div style={styles.grid}>
            {userData.locks.map((lock) => (
              <div key={lock.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.tokenName}>
                    {lock.locker.reputationToken.name}
                  </span>
                  <span style={styles.symbol}>
                    {lock.locker.reputationToken.symbol}
                  </span>
                </div>
                <div style={styles.lockInfo}>
                  <div style={styles.lockRow}>
                    <span style={styles.lockLabel}>Locked Amount:</span>
                    <span style={styles.lockValue}>{formatAmount(lock.totalLocked)}</span>
                  </div>
                  <div style={styles.lockRow}>
                    <span style={styles.lockLabel}>Total Minted:</span>
                    <span style={styles.lockValue}>{formatAmount(lock.reputationMinted)}</span>
                  </div>
                  <div style={styles.lockRow}>
                    <span style={styles.lockLabel}>Last Claim:</span>
                    <span style={styles.lockValue}>
                      {new Date(parseInt(lock.lastClaimTime) * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  placeholder: {
    textAlign: 'center' as const,
    padding: '40px',
    background: 'white',
    borderRadius: '8px',
    color: '#666',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '40px',
    background: 'white',
    borderRadius: '8px',
    color: '#666',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
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
    fontSize: '16px',
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
  balances: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  balanceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: '14px',
    color: '#666',
  },
  balanceValue: {
    fontSize: '18px',
    fontWeight: '600',
  },
  lockInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  lockRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  lockLabel: {
    color: '#666',
  },
  lockValue: {
    fontWeight: '500',
  },
}

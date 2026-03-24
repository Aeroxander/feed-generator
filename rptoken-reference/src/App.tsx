import { useState, useEffect } from 'react'
import { WalletConnect } from './components/WalletConnect'
import { CreateReputationToken } from './components/CreateReputationToken'
import { ReputationTokensList } from './components/ReputationTokensList'
import { UserReputation } from './components/UserReputation'
import { LockTokens } from './components/LockTokens'
import { MintVotes } from './components/MintVotes'
import { ContractDebug } from './components/ContractDebug'
import { graphqlClient } from './graphql/client'
import { GET_ALL_REPUTATION_TOKENS } from './graphql/queries'

interface ReputationToken {
  id: string
  name: string
  symbol: string
  reputationToken: string
  locker: string
}

function App() {
  const [selectedTab, setSelectedTab] = useState<'create' | 'interact' | 'view'>('view')
  const [deployedTokens, setDeployedTokens] = useState<ReputationToken[]>([])
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  
  useEffect(() => {
    async function fetchTokens() {
      try {
        const data = await graphqlClient.request<{ reputationTokenDeployments: ReputationToken[] }>(
          GET_ALL_REPUTATION_TOKENS
        )
        setDeployedTokens(data.reputationTokenDeployments)
      } catch (err) {
        console.error('Error fetching tokens:', err)
      }
    }
    
    fetchTokens()
    // Refresh every 10 seconds
    const interval = setInterval(fetchTokens, 10000)
    return () => clearInterval(interval)
  }, [])
  
  const selectedToken = deployedTokens[selectedTokenIndex]

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.headerTitle}>Reputation Token V2</h1>
          <WalletConnect />
        </div>
      </header>

      <div style={styles.tabs}>
        <button
          onClick={() => setSelectedTab('view')}
          style={{
            ...styles.tab,
            ...(selectedTab === 'view' ? styles.tabActive : {}),
          }}
        >
          📊 View Tokens
        </button>
        <button
          onClick={() => setSelectedTab('create')}
          style={{
            ...styles.tab,
            ...(selectedTab === 'create' ? styles.tabActive : {}),
          }}
        >
          ➕ Create Token
        </button>
        <button
          onClick={() => setSelectedTab('interact')}
          style={{
            ...styles.tab,
            ...(selectedTab === 'interact' ? styles.tabActive : {}),
          }}
        >
          🔄 Interact
        </button>
      </div>

      <main style={styles.main}>
        <div style={styles.container}>
          {selectedTab === 'view' && (
            <>
              <section style={styles.section}>
                <UserReputation />
              </section>
              <section style={styles.section}>
                <ReputationTokensList />
              </section>
            </>
          )}

          {selectedTab === 'create' && (
            <>
              <section style={styles.section}>
                <ContractDebug />
              </section>
              <section style={styles.section}>
                <CreateReputationToken />
              </section>
            </>
          )}

          {selectedTab === 'interact' && (
            <>
              {deployedTokens.length === 0 ? (
                <div style={styles.note}>
                  <p><strong>No reputation tokens deployed yet!</strong></p>
                  <p style={{ marginTop: '8px' }}>Go to the "Create Token" tab to deploy your first reputation token.</p>
                </div>
              ) : (
                <>
                  <section style={styles.section}>
                    <div style={styles.tokenSelector}>
                      <label style={styles.selectorLabel}>Select Reputation Token:</label>
                      <select 
                        value={selectedTokenIndex} 
                        onChange={(e) => setSelectedTokenIndex(Number(e.target.value))}
                        style={styles.select}
                      >
                        {deployedTokens.map((token, index) => (
                          <option key={token.id} value={index}>
                            {token.name} ({token.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>

                  {selectedToken && (
                    <section style={styles.section}>
                      <div style={styles.grid}>
                        <LockTokens 
                          lockerAddress={selectedToken.locker as `0x${string}`} 
                          tokenName={`${selectedToken.name} (${selectedToken.symbol})`}
                        />
                        <MintVotes 
                          lockerAddress={selectedToken.locker as `0x${string}`} 
                          tokenName={`${selectedToken.name} (${selectedToken.symbol})`}
                        />
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        <p>Powered by Wagmi + GraphQL on Base Sepolia</p>
      </footer>
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#f5f5f5',
  },
  header: {
    background: 'white',
    borderBottom: '1px solid #e0e0e0',
    padding: '16px 0',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#0070f3',
  },
  main: {
    flex: 1,
    padding: '32px 0',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
  },
  section: {
    marginBottom: '48px',
  },
  tabs: {
    background: 'white',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 24px',
  },
  tab: {
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#0070f3',
    borderBottomColor: '#0070f3',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
  },
  note: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    margin: '24px 0',
    fontSize: '14px',
    color: '#856404',
  },
  tokenSelector: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  selectorLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#333',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer',
  },
  footer: {
    background: 'white',
    borderTop: '1px solid #e0e0e0',
    padding: '24px',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: '14px',
  },
}

export default App

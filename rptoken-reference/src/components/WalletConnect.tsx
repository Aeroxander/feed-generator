import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div style={styles.connected}>
        <span style={styles.address}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button onClick={() => disconnect()} style={styles.disconnectButton}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          style={styles.connectButton}
        >
          Connect with {connector.name}
        </button>
      ))}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    gap: '10px',
  },
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  address: {
    padding: '8px 12px',
    background: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  connectButton: {
    padding: '10px 20px',
    background: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  disconnectButton: {
    padding: '8px 16px',
    background: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
}

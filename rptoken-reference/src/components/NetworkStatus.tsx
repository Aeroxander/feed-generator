import { useAccount, useChainId } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export function NetworkStatus() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  
  const isCorrectNetwork = chainId === baseSepolia.id

  if (!isConnected) {
    return (
      <div style={styles.warning}>
        <p>⚠️ Wallet not connected</p>
      </div>
    )
  }

  if (!isCorrectNetwork) {
    return (
      <div style={styles.error}>
        <p>❌ Wrong Network!</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>
          Please switch to <strong>Base Sepolia</strong> (Chain ID: {baseSepolia.id})
        </p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>
          Current Chain ID: {chainId}
        </p>
      </div>
    )
  }

  return (
    <div style={styles.success}>
      <p>✅ Connected to Base Sepolia</p>
      <p style={{ fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
        {address}
      </p>
    </div>
  )
}

const styles = {
  warning: {
    padding: '12px 16px',
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  error: {
    padding: '12px 16px',
    background: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
    color: '#721c24',
  },
  success: {
    padding: '12px 16px',
    background: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
    color: '#155724',
  },
}

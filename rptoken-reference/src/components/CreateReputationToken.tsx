import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseEther } from 'viem'
import { ReputationTokenV2FactoryABI } from '../abis/ReputationTokenV2Factory'
import { NetworkStatus } from './NetworkStatus'

// Deployed addresses on Base Sepolia
const FACTORY_ADDRESS = '0x0b15d7db170f73bfbc2194a5a4330c4804ec0cf3' as `0x${string}`

export function CreateReputationToken() {
  const { isConnected } = useAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [metadataURI, setMetadataURI] = useState('')
  const [mintRatePerDay, setMintRatePerDay] = useState('10')
  const [error, setError] = useState<string | null>(null)

  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract()

  const { 
    isLoading: isConfirming, 
    isSuccess,
    error: confirmError 
  } = useWaitForTransactionReceipt({
    hash,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: ReputationTokenV2FactoryABI,
        functionName: 'deployReputationToken',
        args: [
          name,
          symbol,
          metadataURI,
          parseEther(mintRatePerDay), // Convert to wei (18 decimals)
        ],
      })
    } catch (err) {
      console.error('Error deploying reputation token:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Create Reputation Token</h2>
      
      <NetworkStatus />
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Token Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Like Reputation"
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Token Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g., LIKE"
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Metadata URI</label>
          <input
            type="text"
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="ipfs://... or https://..."
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Mint Rate Per Day (RP tokens)</label>
          <input
            type="number"
            value={mintRatePerDay}
            onChange={(e) => setMintRatePerDay(e.target.value)}
            placeholder="10"
            required
            min="0.000000000000000001"
            step="0.1"
            style={styles.input}
          />
          <small style={styles.helper}>
            Amount of reputation tokens earned per locked token per day
          </small>
        </div>

        <button
          type="submit"
          disabled={!isConnected || isPending || isConfirming}
          style={{
            ...styles.button,
            ...(!isConnected || isPending || isConfirming ? styles.buttonDisabled : {}),
          }}
        >
          {!isConnected 
            ? 'Connect Wallet First' 
            : isPending 
            ? 'Waiting for signature...' 
            : isConfirming 
            ? 'Confirming on blockchain...' 
            : 'Create Token'
          }
        </button>

        {hash && !isSuccess && !confirmError && (
          <div style={styles.status}>
            <p>⏳ Transaction submitted!</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>Hash: {hash}</p>
            <a 
              href={`https://sepolia.basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View on BaseScan →
            </a>
          </div>
        )}

        {isConfirming && (
          <div style={styles.pending}>
            <p>⏳ Waiting for confirmation... This may take a few seconds.</p>
          </div>
        )}

        {isSuccess && (
          <div style={styles.success}>
            <p>✅ Reputation token deployed successfully!</p>
            <a 
              href={`https://sepolia.basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View on BaseScan →
            </a>
          </div>
        )}

        {(writeError || confirmError || error) && (
          <div style={styles.error}>
            <p>❌ Error: {writeError?.message || confirmError?.message || error}</p>
          </div>
        )}
      </form>
    </div>
  )
}

const styles = {
  container: {
    background: 'white',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: '24px',
    fontWeight: '600',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  helper: {
    fontSize: '12px',
    color: '#666',
  },
  button: {
    padding: '12px 24px',
    background: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    marginTop: '8px',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  status: {
    padding: '12px',
    background: '#fff3cd',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #ffc107',
  },
  pending: {
    padding: '12px',
    background: '#d1ecf1',
    color: '#0c5460',
    borderRadius: '4px',
    fontSize: '14px',
    border: '1px solid #bee5eb',
  },
  success: {
    padding: '12px',
    background: '#d4edda',
    color: '#155724',
    borderRadius: '4px',
    fontSize: '14px',
    border: '1px solid #c3e6cb',
  },
  error: {
    padding: '12px',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    fontSize: '14px',
    border: '1px solid #f5c6cb',
    wordBreak: 'break-word' as const,
  },
  link: {
    color: '#0070f3',
    textDecoration: 'none',
    fontSize: '13px',
    display: 'inline-block',
    marginTop: '8px',
  },
}

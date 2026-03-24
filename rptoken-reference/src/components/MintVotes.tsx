import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEther, formatEther, isAddress } from 'viem'
import { ReputationTokenV2LockerABI } from '../abis/ReputationTokenV2Locker'

interface MintVotesProps {
  lockerAddress: `0x${string}`
  tokenName: string
}

export function MintVotes({ lockerAddress, tokenName }: MintVotesProps) {
  const { address } = useAccount()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [voteType, setVoteType] = useState<'upvote' | 'downvote'>('upvote')

  const { data: lockInfo } = useReadContract({
    address: lockerAddress,
    abi: ReputationTokenV2LockerABI,
    functionName: 'getLockInfo',
    args: address ? [address] : undefined,
  })

  const { data: hash, writeContract, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const handleMint = async () => {
    if (!recipient || !amount || !isAddress(recipient)) return
    
    try {
      if (voteType === 'upvote') {
        writeContract({
          address: lockerAddress,
          abi: ReputationTokenV2LockerABI,
          functionName: 'mintUpvote',
          args: [recipient as `0x${string}`, parseEther(amount)],
        })
      } else {
        writeContract({
          address: lockerAddress,
          abi: ReputationTokenV2LockerABI,
          functionName: 'mintDownvote',
          args: [recipient as `0x${string}`, parseEther(amount)],
        })
      }
    } catch (error) {
      console.error('Error minting vote:', error)
    }
  }

  const availableAllowance = lockInfo ? formatEther(lockInfo[3]) : '0'

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Mint Votes - {tokenName}</h3>
      
      <div style={styles.info}>
        <div style={styles.infoRow}>
          <span>Available Allowance:</span>
          <span style={styles.valueHighlight}>
            {availableAllowance} RP
          </span>
        </div>
        {lockInfo && (
          <div style={styles.infoRow}>
            <span>Total Minted:</span>
            <span style={styles.value}>
              {formatEther(lockInfo[2])} RP
            </span>
          </div>
        )}
      </div>

      <div style={styles.voteTypeToggle}>
        <button
          onClick={() => setVoteType('upvote')}
          style={{
            ...styles.toggleButton,
            ...(voteType === 'upvote' ? styles.toggleButtonActive : {}),
            background: voteType === 'upvote' ? '#4caf50' : '#e0e0e0',
          }}
        >
          👍 Upvote
        </button>
        <button
          onClick={() => setVoteType('downvote')}
          style={{
            ...styles.toggleButton,
            ...(voteType === 'downvote' ? styles.toggleButtonActive : {}),
            background: voteType === 'downvote' ? '#f44336' : '#e0e0e0',
          }}
        >
          👎 Downvote
        </button>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Recipient Address</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          style={styles.input}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          min="0"
          step="0.1"
          style={styles.input}
        />
      </div>

      <button
        onClick={handleMint}
        disabled={!recipient || !amount || isPending || isConfirming || !isAddress(recipient)}
        style={{
          ...styles.button,
          background: voteType === 'upvote' ? '#4caf50' : '#f44336',
          ...(!recipient || !amount || isPending || isConfirming || !isAddress(recipient) 
            ? styles.buttonDisabled 
            : {}),
        }}
      >
        {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : `Mint ${voteType === 'upvote' ? 'Upvote' : 'Downvote'}`}
      </button>

      {isSuccess && (
        <div style={styles.success}>
          ✅ {voteType === 'upvote' ? 'Upvote' : 'Downvote'} minted successfully!
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
  },
  info: {
    background: '#f5f5f5',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '14px',
  },
  value: {
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  valueHighlight: {
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#0070f3',
  },
  voteTypeToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  toggleButton: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  toggleButtonActive: {
    color: 'white',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  button: {
    width: '100%',
    padding: '12px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
  },
  buttonDisabled: {
    background: '#ccc !important' as any,
    cursor: 'not-allowed',
  },
  success: {
    marginTop: '12px',
    padding: '12px',
    background: '#d4edda',
    color: '#155724',
    borderRadius: '4px',
    fontSize: '14px',
  },
}

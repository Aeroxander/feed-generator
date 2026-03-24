import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { MainTokenABI } from '../abis/MainToken'
import { ReputationTokenV2LockerABI } from '../abis/ReputationTokenV2Locker'

const MAIN_TOKEN_ADDRESS = '0xc6c39febb38c3055e07782adcdb356e37e416424' as `0x${string}`

interface LockTokensProps {
  lockerAddress: `0x${string}`
  tokenName: string
}

export function LockTokens({ lockerAddress, tokenName }: LockTokensProps) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')

  const { data: balance } = useReadContract({
    address: MAIN_TOKEN_ADDRESS,
    abi: MainTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MAIN_TOKEN_ADDRESS,
    abi: MainTokenABI,
    functionName: 'allowance',
    args: address ? [address, lockerAddress] : undefined,
  })

  const { data: lockInfo, refetch: refetchLockInfo } = useReadContract({
    address: lockerAddress,
    abi: ReputationTokenV2LockerABI,
    functionName: 'getLockInfo',
    args: address ? [address] : undefined,
  })

  const { data: approveHash, writeContract: approve, error: approveError } = useWriteContract()
  const { data: lockHash, writeContract: lock, error: lockError } = useWriteContract()

  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const { 
    isLoading: isLockPending, 
    isSuccess: isLockSuccess,
    error: lockConfirmError
  } = useWaitForTransactionReceipt({
    hash: lockHash,
  })

  // Refetch allowance after approval succeeds
  if (isApproveSuccess && approveHash) {
    refetchAllowance()
  }

  // Refetch lock info after lock succeeds
  if (isLockSuccess && lockHash) {
    refetchLockInfo()
  }

  const handleApprove = async () => {
    if (!amount) return
    
    try {
      approve({
        address: MAIN_TOKEN_ADDRESS,
        abi: MainTokenABI,
        functionName: 'approve',
        args: [lockerAddress, parseEther(amount)],
      })
    } catch (error) {
      console.error('Error approving:', error)
    }
  }

  const handleLock = async () => {
    if (!amount) return
    
    try {
      lock({
        address: lockerAddress,
        abi: ReputationTokenV2LockerABI,
        functionName: 'lockTokens',
        args: [parseEther(amount)],
      })
    } catch (error) {
      console.error('Error locking:', error)
    }
  }

  const needsApproval = amount && allowance !== undefined 
    ? parseEther(amount) > allowance 
    : true

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Lock Tokens - {tokenName}</h3>
      
      <div style={styles.info}>
        <div style={styles.infoRow}>
          <span>Your Balance:</span>
          <span style={styles.value}>
            {balance ? formatEther(balance) : '0'} tokens
          </span>
        </div>
        <div style={styles.infoRow}>
          <span>Approved Amount:</span>
          <span style={styles.value}>
            {allowance ? formatEther(allowance) : '0'} tokens
          </span>
        </div>
        {lockInfo && (
          <>
            <div style={styles.infoRow}>
              <span>Currently Locked:</span>
              <span style={styles.value}>
                {formatEther(lockInfo[0])} tokens
              </span>
            </div>
            <div style={styles.infoRow}>
              <span>Available Allowance:</span>
              <span style={styles.valueHighlight}>
                {formatEther(lockInfo[3])} RP
              </span>
            </div>
          </>
        )}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Amount to Lock</label>
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

      {needsApproval ? (
        <>
          <button
            onClick={handleApprove}
            disabled={!amount || isApprovePending}
            style={{
              ...styles.button,
              ...(!amount || isApprovePending ? styles.buttonDisabled : {}),
            }}
          >
            {isApprovePending ? 'Approving...' : 'Approve Tokens'}
          </button>
          {approveHash && !isApproveSuccess && (
            <div style={styles.pending}>
              ⏳ Approval pending...
              <a 
                href={`https://sepolia.basescan.org/tx/${approveHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on BaseScan
              </a>
            </div>
          )}
          {isApproveSuccess && (
            <div style={styles.success}>
              ✅ Approval successful! Now you can lock tokens.
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={handleLock}
            disabled={!amount || isLockPending}
            style={{
              ...styles.button,
              ...(!amount || isLockPending ? styles.buttonDisabled : {}),
            }}
          >
            {isLockPending ? 'Locking...' : 'Lock Tokens'}
          </button>
          {lockHash && !isLockSuccess && !lockConfirmError && (
            <div style={styles.pending}>
              ⏳ Lock transaction pending...
              <a 
                href={`https://sepolia.basescan.org/tx/${lockHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on BaseScan
              </a>
            </div>
          )}
        </>
      )}

      {isLockSuccess && (
        <div style={styles.success}>
          ✅ Tokens locked successfully!
          <a 
            href={`https://sepolia.basescan.org/tx/${lockHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on BaseScan
          </a>
        </div>
      )}

      {(approveError || lockError || lockConfirmError) && (
        <div style={styles.error}>
          ❌ Error: {approveError?.message || lockError?.message || lockConfirmError?.message}
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
    background: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  pending: {
    marginTop: '12px',
    padding: '12px',
    background: '#d1ecf1',
    color: '#0c5460',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #bee5eb',
  },
  success: {
    marginTop: '12px',
    padding: '12px',
    background: '#d4edda',
    color: '#155724',
    borderRadius: '4px',
    fontSize: '14px',
    border: '1px solid #c3e6cb',
  },
  error: {
    marginTop: '12px',
    padding: '12px',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #f5c6cb',
    wordBreak: 'break-word' as const,
  },
  link: {
    display: 'block',
    color: '#0070f3',
    textDecoration: 'none',
    fontSize: '12px',
    marginTop: '6px',
  },
}

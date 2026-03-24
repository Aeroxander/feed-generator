import { useReadContract } from 'wagmi'
import { ReputationTokenV2FactoryABI } from '../abis/ReputationTokenV2Factory'
import { MainTokenABI } from '../abis/MainToken'

const FACTORY_ADDRESS = '0x0b15d7db170f73bfbc2194a5a4330c4804ec0cf3' as `0x${string}`
const MAIN_TOKEN_ADDRESS = '0xc6c39febb38c3055e07782adcdb356e37e416424' as `0x${string}`

export function ContractDebug() {
  const { data: mainTokenAddress, error: mainTokenError } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: ReputationTokenV2FactoryABI,
    functionName: 'mainToken',
  })

  const { data: tokenCount, error: tokenCountError } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: ReputationTokenV2FactoryABI,
    functionName: 'getReputationTokenCount',
  })

  const { data: mainTokenName } = useReadContract({
    address: MAIN_TOKEN_ADDRESS,
    abi: MainTokenABI,
    functionName: 'name',
  })

  const { data: mainTokenSymbol } = useReadContract({
    address: MAIN_TOKEN_ADDRESS,
    abi: MainTokenABI,
    functionName: 'symbol',
  })

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>🔍 Contract Status</h3>
      
      <div style={styles.section}>
        <h4 style={styles.subtitle}>Factory Contract</h4>
        <div style={styles.info}>
          <div style={styles.row}>
            <span>Address:</span>
            <code style={styles.code}>{FACTORY_ADDRESS}</code>
          </div>
          <div style={styles.row}>
            <span>Main Token:</span>
            {mainTokenError ? (
              <span style={styles.error}>❌ Error reading</span>
            ) : mainTokenAddress ? (
              <code style={styles.code}>{mainTokenAddress}</code>
            ) : (
              <span>Loading...</span>
            )}
          </div>
          <div style={styles.row}>
            <span>Deployed Tokens:</span>
            {tokenCountError ? (
              <span style={styles.error}>❌ Error reading</span>
            ) : tokenCount !== undefined ? (
              <strong>{tokenCount.toString()}</strong>
            ) : (
              <span>Loading...</span>
            )}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.subtitle}>Main Token</h4>
        <div style={styles.info}>
          <div style={styles.row}>
            <span>Address:</span>
            <code style={styles.code}>{MAIN_TOKEN_ADDRESS}</code>
          </div>
          <div style={styles.row}>
            <span>Name:</span>
            <strong>{mainTokenName || 'Loading...'}</strong>
          </div>
          <div style={styles.row}>
            <span>Symbol:</span>
            <strong>{mainTokenSymbol || 'Loading...'}</strong>
          </div>
        </div>
      </div>

      {(mainTokenError || tokenCountError) && (
        <div style={styles.errorBox}>
          <p><strong>⚠️ Contract Reading Issues:</strong></p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '12px' }}>
            <li>Make sure you're connected to <strong>Base Sepolia</strong></li>
            <li>Verify contract addresses are correct</li>
            <li>Check if contracts are verified on BaseScan</li>
          </ul>
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
    marginBottom: '24px',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
  },
  section: {
    marginBottom: '16px',
  },
  subtitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
  },
  info: {
    background: '#f5f5f5',
    borderRadius: '4px',
    padding: '12px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: '13px',
    gap: '12px',
  },
  code: {
    fontSize: '11px',
    fontFamily: 'monospace',
    background: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    border: '1px solid #ddd',
  },
  error: {
    color: '#d32f2f',
    fontSize: '12px',
  },
  errorBox: {
    marginTop: '16px',
    padding: '12px',
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '13px',
  },
}

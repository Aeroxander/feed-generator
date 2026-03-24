# Reputation Token V2 - Web Interface

A React application for interacting with Reputation Token V2 contracts using Wagmi and displaying data with GraphQL.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## � What This Does

This web interface allows you to:

1. **View Deployed Tokens** - See all reputation tokens that have been created via the factory
2. **Create New Reputation Tokens** - Deploy new reputation token types with custom names, symbols, and mint rates
3. **Lock Main Tokens** - Lock your main tokens to earn reputation minting allowance over time
4. **Mint Upvotes/Downvotes** - Use your earned allowance to give upvotes or downvotes to any address

## 🔧 How It Works

### Architecture

```
MainToken (ERC20)
    ↓ (users lock tokens here)
ReputationTokenV2Factory
    ↓ (deploys)
ReputationTokenV2 + ReputationTokenV2Locker
    ↓ (tracked by)
The Graph Subgraph
    ↓ (queried by)
React Web Interface
```

### The Workflow

1. **Main Token Exists**: The main token (`0xc6c39feb...`) is already deployed on Base Sepolia
2. **Create Reputation Token**: Use the factory to deploy a new reputation token type (e.g., "Like", "Comment", "Share")
3. **Lock Main Tokens**: Lock your main tokens in the locker contract to earn minting allowance
4. **Earn Allowance**: Based on the mint rate (e.g., 10 RP/token/day), you earn reputation minting power
5. **Mint Votes**: Use your allowance to mint upvotes or downvotes to any recipient address
6. **View on Subgraph**: All actions are indexed by The Graph and displayed in real-time

## � Features

### View Tab
- **User Reputation**: See your reputation balances and locks across all token types
- **All Tokens**: Browse all deployed reputation tokens with stats

### Create Tab
- **Deploy New Token Type**: Create a new reputation token category
  - Custom name and symbol
  - Set mint rate (how much RP per locked token per day)
  - Optional metadata URI

### Interact Tab
- **Lock Tokens**: Lock main tokens to start earning allowance
  - Approve main tokens for the locker
  - Lock any amount
  - View your current locked balance and available allowance
  
- **Mint Votes**: Give upvotes or downvotes
  - Toggle between upvote (👍) and downvote (👎)
  - Enter recipient address
  - Mint using your earned allowance

## 🔑 Deployed Addresses (Base Sepolia)

```
Main Token:     0xc6c39febb38c3055e07782adcdb356e37e416424
Factory V2:     0x0b15d7db170f73bfbc2194a5a4330c4804ec0cf3
Subgraph:       https://subgraph.satsuma-prod.com/...
```

## 💡 Usage Example

1. **Connect Wallet**: Click "Connect with Injected" to connect MetaMask
2. **Get Main Tokens**: You need main tokens first (ask the deployer or get from a faucet if public)
3. **Create a Reputation Type**: 
   - Go to "Create Token" tab
   - Name: "Like Reputation"
   - Symbol: "LIKE"
   - Mint Rate: 10
   - Click "Create Token"
4. **Lock Tokens**:
   - Go to "Interact" tab
   - Select your deployed token from the list
   - Enter amount to lock
   - Click "Approve Tokens" first, then "Lock Tokens"
5. **Wait & Earn**: Your allowance accrues over time based on the mint rate
6. **Mint Votes**:
   - Select Upvote or Downvote
   - Enter recipient address
   - Click "Mint Upvote/Downvote"

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Wagmi v2** - React hooks for Ethereum
- **Viem** - Low-level Ethereum library
- **GraphQL Request** - GraphQL client for subgraph
- **TanStack Query** - Async state management

## 📝 GraphQL Queries

The app uses these queries from The Graph subgraph:

- `GET_ALL_REPUTATION_TOKENS` - Fetch all deployed reputation token deployments
- `GET_USER_REPUTATION` - Get user's reputation balances and locks
- `GET_RECENT_VOTES` - Fetch recent upvotes and downvotes

## 🌐 Network Configuration

Currently configured for **Base Sepolia** testnet. To use a different network:

1. Update chain in `src/wagmi.ts`
2. Update GraphQL endpoint in `src/graphql/client.ts`
3. Update contract addresses in components

## 🏗️ Building for Production

```bash
npm run build
```

Built files will be in the `dist` directory.

```bash
npm run preview
```

Preview the production build locally.

## 🔍 Understanding the System

### Main Token
- Standard ERC20 token
- Users lock this to earn reputation minting allowance
- Can be unlocked anytime (no lock period)

### Reputation Token
- Soulbound (non-transferable)
- Tracks upvotes and downvotes separately
- `balanceOf` returns net reputation (upvotes - downvotes)
- Used for voting/governance based on reputation

### Locker
- Manages locks of main tokens
- Accrues minting allowance over time
- Allowance is spent to mint upvotes or downvotes
- Same allowance pool for both upvotes and downvotes

### Factory
- Deploys new reputation token + locker pairs
- Each deployment creates a new "type" of reputation
- All use the same main token for locking

## 🐛 Troubleshooting

**"Insufficient allowance"**
- Make sure to approve tokens before locking

**"No tokens to lock"**
- You need main tokens first - get them from the deployer or faucet

**"Insufficient Allowance" when minting**
- Wait for allowance to accrue based on your locked tokens and time elapsed
- Formula: `allowance = (lockedAmount × mintRate × timeElapsed) / (86400 × 1e18)`

**GraphQL data not showing**
- Make sure the subgraph is synced
- Check that you're on the correct network (Base Sepolia)

import { gql } from 'graphql-request'

export const GET_ALL_REPUTATION_TOKENS = gql`
  query GetAllReputationTokens {
    reputationTokenDeployments(orderBy: deployedAt, orderDirection: desc) {
      id
      name
      symbol
      reputationToken
      locker
      creator
      deployedAt
      totalLocked
      totalUpvotesMinted
      totalDownvotesMinted
      totalHolders
    }
  }
`

export const GET_REPUTATION_TOKEN_BY_ID = gql`
  query GetReputationTokenById($id: ID!) {
    reputationToken(id: $id) {
      id
      name
      symbol
      address
      locker
      creator
      deployedAt
      mintRatePerDay
      totalUpvotes
      totalDownvotes
      holders {
        id
        user
        upvotes
        downvotes
        netReputation
      }
    }
  }
`

export const GET_USER_REPUTATION = gql`
  query GetUserReputation($userId: ID!) {
    user(id: $userId) {
      id
      address
      reputationBalances {
        id
        reputationToken {
          id
          name
          symbol
          address
        }
        upvotes
        downvotes
        netReputation
      }
      locks {
        id
        locker {
          id
          reputationToken {
            name
            symbol
          }
        }
        totalLocked
        reputationMinted
        lastClaimTime
      }
    }
  }
`

export const GET_RECENT_VOTES = gql`
  query GetRecentVotes($first: Int = 10) {
    upvotes(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      from
      to
      amount
      timestamp
      reputationToken {
        id
        name
        symbol
      }
    }
    downvotes(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      from
      to
      amount
      timestamp
      reputationToken {
        id
        name
        symbol
      }
    }
  }
`

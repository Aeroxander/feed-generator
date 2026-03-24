import { GraphQLClient } from 'graphql-request'

const GRAPHQL_ENDPOINT = 'https://subgraph.satsuma-prod.com/ebb29fbd75c2/creaton--2784/reputation-token-v2/version/v0.1.3/api'

export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT)

import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import redirectToInit from './redirectToInit'
import { buildResolvers, buildTypeDefs } from './operations'

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  const { Query, Mutation } = buildResolvers()
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: buildTypeDefs(),
    resolvers: {
      Query: { redirectToInit, ...Query },
      Mutation,
    },
  })
}

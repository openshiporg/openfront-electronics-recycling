import { keystoneContext } from '../../features/keystone/context'
import { useMcpScopeGuard } from '../../features/keystone/mcp-oauth/guard'
import { noteRequestOrigin } from '../../features/keystone/lib/services'
import { createYoga } from "graphql-yoga";
// @ts-ignore
import processRequest from "graphql-upload/processRequest.js";
import { type NextApiRequest, type NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const contentType = req.headers["content-type"];
  if (contentType?.startsWith("multipart/form-data")) {
    req.body = await processRequest(req, res);
  }

  return createYoga({
    // GraphiQL for signed-in staff exploring the API; same schema and access rules.
    graphiql: { title: "Openfront Electronics Recycling API" },
    graphqlEndpoint: "/api/graphql",
    schema: keystoneContext.graphql.schema,
    context: async ({ req, res }: { req: any; res: any }) => {
      const context = await keystoneContext.withRequest(req, res);
      // Staff requests give email links a base when Settings has no site address yet.
      await noteRequestOrigin(context as any);
      return context;
    },
    multipart: false,
    // MCP OAuth scopes only narrow: read-only tokens can't mutate, no token can manage credentials.
    plugins: [useMcpScopeGuard()],
  })(req, res);
}
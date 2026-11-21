import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { createHash } from "node:crypto";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { withMcpBearerSessions } from "./mcp-oauth/session";
import { ROLE_PERMISSIONS, SESSION_DATA } from "./access";

const databaseURL = process.env.DATABASE_URL || "file:./keystone.db";

// SESSION_SECRET should be set on every deployment. Without it the secret is derived
// from the database address, so sign-in still works and stays stable across restarts.
const sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret:
    process.env.SESSION_SECRET ||
    createHash("sha256").update(`openfront-electronics-recycling:${databaseURL}`).digest("hex"),
};

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      kind: "staff",
      role: {
        create: {
          name: "Owner",
          ...Object.fromEntries(ROLE_PERMISSIONS.map((permission) => [permission, true])),
        },
      },
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
  sessionData: SESSION_DATA,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
    },
    lists: models,
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false,
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions(statelessSessions(sessionConfig)),
    graphql: {
      extendGraphqlSchema,
    },
  })
);
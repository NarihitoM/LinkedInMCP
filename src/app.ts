import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createMcpServer } from "./mcp/server.ts";
import { authRouter, grantSchema, LinkedInOAuthProvider, MCP_SCOPE } from "./modules/auth/index.ts";
import { homeRouter, MCP_PATH } from "./modules/home/index.ts";
import { sessionRouter } from "./modules/session/index.ts";
import { browserToolsEnabled, getEnv } from "./shared/lib/env.ts";
import { errorHandler } from "./shared/middlewares/errorHandler.ts";

const env = getEnv();
const mcpUrl = new URL(`${env.BASE_URL}${MCP_PATH}`);
const provider = new LinkedInOAuthProvider();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: new URL(env.BASE_URL),
    resourceServerUrl: mcpUrl,
    scopesSupported: [MCP_SCOPE],
    resourceName: "LinkedIn MCP",
    clientRegistrationOptions: { clientIdGeneration: false },
  }),
);
app.use(homeRouter);
app.use(authRouter);
if (browserToolsEnabled()) {
  app.use(sessionRouter);
}

const bearerAuth = requireBearerAuth({
  verifier: provider,
  requiredScopes: [MCP_SCOPE],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
});

app.post(MCP_PATH, bearerAuth, express.json({ limit: "15mb" }), async (req, res, next) => {
  const grant = grantSchema.safeParse(req.auth?.extra?.grant);
  if (!grant.success) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  try {
    const { userId, member, linkedin } = grant.data;
    const server = createMcpServer({ userId, member, linkedin });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(error);
  }
});

app.all(MCP_PATH, (_req, res) => {
  res.status(405).set("Allow", "POST").json({ error: "method_not_allowed" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use(errorHandler);

export default app;

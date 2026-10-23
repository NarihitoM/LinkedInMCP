import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createMcpServer } from "./mcp/server.ts";
import { authRouter, LinkedInOAuthProvider, MCP_SCOPE } from "./modules/auth/index.ts";
import { attachSessionSocket, sessionRouter } from "./modules/session/index.ts";
import { closeBrowser } from "./shared/lib/browserPool.ts";
import { getEnv } from "./shared/lib/env.ts";
import { logger } from "./shared/lib/logger.ts";
import { errorHandler } from "./shared/middlewares/errorHandler.ts";

const env = getEnv();
const MCP_PATH = "/mcp";
const mcpUrl = new URL(`${env.BASE_URL}${MCP_PATH}`);
const provider = new LinkedInOAuthProvider();

const app = express();
app.disable("x-powered-by");

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
app.use(authRouter);
app.use(sessionRouter);

app.get("/", (_req, res) => {
  res.json({ name: "linkedin-mcp", mcp: mcpUrl.toString() });
});

const bearerAuth = requireBearerAuth({
  verifier: provider,
  requiredScopes: [MCP_SCOPE],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
});

app.post(MCP_PATH, bearerAuth, express.json({ limit: "15mb" }), async (req, res, next) => {
  const userId = req.auth?.extra?.userId;
  if (typeof userId !== "string") {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  try {
    const server = createMcpServer({ userId });
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

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info("LinkedIn MCP server listening", { url: env.BASE_URL, mcp: mcpUrl.toString() });
});
attachSessionSocket(server);

async function shutdown(signal: string): Promise<void> {
  logger.info("Shutting down", { signal });
  server.close();
  await closeBrowser().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

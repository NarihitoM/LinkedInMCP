import app from "./app.ts";
import { attachSessionSocket } from "./modules/session/index.ts";
import { closeBrowser } from "./shared/lib/browserPool.ts";
import { browserToolsEnabled, getEnv } from "./shared/lib/env.ts";
import { logger } from "./shared/lib/logger.ts";

const env = getEnv();

const server = app.listen(env.PORT, () => {
  logger.info("LinkedIn MCP server listening", {
    url: env.BASE_URL,
    mcp: `${env.BASE_URL}/mcp`,
    browserTools: browserToolsEnabled(),
  });
});

if (browserToolsEnabled()) {
  attachSessionSocket(server);
}

async function shutdown(signal: string): Promise<void> {
  logger.info("Shutting down", { signal });
  server.close();
  await closeBrowser().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

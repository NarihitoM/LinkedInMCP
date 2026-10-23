import app from "./app.ts";
import { getEnv } from "./shared/lib/env.ts";
import { logger } from "./shared/lib/logger.ts";

const env = getEnv();

const server = app.listen(env.PORT, () => {
  logger.info("LinkedIn MCP server listening", { url: env.BASE_URL, mcp: `${env.BASE_URL}/mcp` });
});

function shutdown(signal: string): void {
  logger.info("Shutting down", { signal });
  server.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

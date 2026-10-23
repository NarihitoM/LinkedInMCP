import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "../modules/auth/index.ts";
import { registerJobsTools } from "../modules/jobs/index.ts";
import { registerMessagingTools } from "../modules/messaging/index.ts";
import { registerNetworkTools } from "../modules/network/index.ts";
import { registerPostsTools } from "../modules/posts/index.ts";
import { registerProfileTools } from "../modules/profile/index.ts";
import { registerSessionTools } from "../modules/session/index.ts";
import type { ToolContext } from "../shared/types/tool.ts";

const INSTRUCTIONS = `Manage the user's LinkedIn account.
Posting and deleting posts use LinkedIn's official API. Everything else drives a private headless browser logged in as the user.
If a tool says the browser session is not connected, give the user the link from the error message and wait for them to log in before retrying.
Profile identifiers can be a full profile URL (https://www.linkedin.com/in/someone/) or the public id (someone).`;

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: "linkedin-mcp", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  registerAuthTools(server, context);
  registerSessionTools(server, context);
  registerProfileTools(server, context);
  registerPostsTools(server, context);
  registerNetworkTools(server, context);
  registerMessagingTools(server, context);
  registerJobsTools(server, context);

  return server;
}

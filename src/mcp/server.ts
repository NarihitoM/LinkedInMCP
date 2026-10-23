import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "../modules/auth/index.ts";
import { registerPostsTools } from "../modules/posts/index.ts";
import type { ToolContext } from "../shared/types/tool.ts";

const INSTRUCTIONS = `Manage the user's LinkedIn account through LinkedIn's official API.
whoami shows the signed-in member. create_post and delete_post publish and remove posts on their feed.`;

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: "linkedin-mcp", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  registerAuthTools(server, context);
  registerPostsTools(server, context);

  return server;
}

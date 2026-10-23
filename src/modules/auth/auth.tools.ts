import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";

export function registerAuthTools(server: McpServer, context: ToolContext): void {
  defineTool(server, {
    name: "whoami",
    title: "Who am I",
    description: "Show the connected LinkedIn member (name, email, photo, member URN) and when the sign-in expires.",
    kind: "read",
    input: {},
    handler: async () => ({
      name: context.member.name,
      email: context.member.email ?? null,
      picture: context.member.picture ?? null,
      memberUrn: `urn:li:person:${context.member.sub}`,
      signInExpiresAt: new Date(context.linkedin.expiresAt).toISOString(),
      grantedScopes: context.linkedin.scopes,
    }),
  });
}

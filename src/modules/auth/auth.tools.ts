import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readUser } from "../../shared/lib/userStore.ts";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { ToolError } from "../../shared/utils/errors.ts";

export function registerAuthTools(server: McpServer, context: ToolContext): void {
  defineTool(server, {
    name: "whoami",
    title: "Who am I",
    description: "Show the connected LinkedIn account, when its sign-in expires, and whether the browser session is connected.",
    kind: "read",
    input: {},
    handler: async () => {
      const user = await readUser(context.userId);
      if (!user) throw new ToolError("Account not found. Reconnect the LinkedIn MCP server in Claude.");
      return {
        name: user.name,
        email: user.email ?? null,
        memberUrn: `urn:li:person:${user.sub}`,
        profileUrl: user.browser ? `https://www.linkedin.com/in/${user.browser.publicIdentifier}/` : null,
        signInExpiresAt: new Date(user.linkedin.expiresAt).toISOString(),
        grantedScopes: user.linkedin.scopes,
        browserSession: user.browser?.status ?? "not connected",
      };
    },
  });
}

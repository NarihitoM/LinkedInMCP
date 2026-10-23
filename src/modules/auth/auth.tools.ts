import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { browserToolsEnabled } from "../../shared/lib/env.ts";
import { readUser } from "../../shared/lib/userStore.ts";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";

export function registerAuthTools(server: McpServer, context: ToolContext): void {
  defineTool(server, {
    name: "whoami",
    title: "Who am I",
    description:
      "Show the connected LinkedIn member (name, email, photo, member URN), when the sign-in expires, and whether the browser session is connected.",
    kind: "read",
    input: {},
    handler: async () => {
      const browserEnabled = browserToolsEnabled();
      const browser = browserEnabled ? (await readUser(context.userId))?.browser : undefined;
      return {
        name: context.member.name,
        email: context.member.email ?? null,
        picture: context.member.picture ?? null,
        memberUrn: `urn:li:person:${context.member.sub}`,
        profileUrl: browser ? `https://www.linkedin.com/in/${browser.publicIdentifier}/` : null,
        signInExpiresAt: new Date(context.linkedin.expiresAt).toISOString(),
        grantedScopes: context.linkedin.scopes,
        browserTools: browserEnabled ? (browser?.status ?? "not connected") : "not available on this deployment",
      };
    },
  });
}

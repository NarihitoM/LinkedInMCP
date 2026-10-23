import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { createConnectUrl, disconnectBrowserSession, getSessionStatus, setProxy } from "./session.service.ts";

export function registerSessionTools(server: McpServer, context: ToolContext): void {
  defineTool(server, {
    name: "session_status",
    title: "Browser session status",
    description:
      "Check whether the LinkedIn browser session (used for profile edits, networking, messaging and jobs) is connected and valid.",
    kind: "read",
    input: {},
    handler: () => getSessionStatus(context.userId),
  });

  defineTool(server, {
    name: "connect_session_link",
    title: "Get session connect link",
    description:
      "Create a one-time link (valid 15 minutes) where the user logs in to LinkedIn in a private server-side browser. Give the link to the user to open.",
    kind: "write",
    input: {},
    handler: async () => ({ url: await createConnectUrl(context.userId), expiresInMinutes: 15 }),
  });

  defineTool(server, {
    name: "disconnect_session",
    title: "Disconnect browser session",
    description: "Delete the stored LinkedIn browser session from the server. Official API features keep working.",
    kind: "destructive",
    input: {},
    handler: async () => {
      await disconnectBrowserSession(context.userId);
      return "Browser session deleted.";
    },
  });

  defineTool(server, {
    name: "set_browser_proxy",
    title: "Set browser proxy",
    description:
      "Route this user's LinkedIn browser through a proxy (http://, https:// or socks5://, credentials allowed). Pass nothing to remove it. Reconnect the session after changing it.",
    kind: "write",
    input: {
      proxyUrl: z.url().optional().describe("Proxy URL, for example http://user:pass@host:port. Omit to clear."),
    },
    handler: async ({ proxyUrl }) => {
      await setProxy(context.userId, proxyUrl);
      return proxyUrl ? "Proxy saved. Reconnect the browser session so the login uses it." : "Proxy removed.";
    },
  });
}

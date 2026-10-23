import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { listConversations, readConversation, sendMessage } from "./messaging.service.ts";

const conversation = z.string().min(4).describe("Conversation id or URL from list_conversations");

export function registerMessagingTools(server: McpServer, context: ToolContext): void {
  const { userId } = context;

  defineTool(server, {
    name: "list_conversations",
    title: "List conversations",
    description: "List recent LinkedIn message conversations with a preview of the last message.",
    kind: "read",
    input: { limit: z.number().int().min(1).max(50).default(15), unreadOnly: z.boolean().default(false) },
    handler: ({ limit, unreadOnly }) => listConversations(userId, limit, unreadOnly),
  });

  defineTool(server, {
    name: "read_conversation",
    title: "Read conversation",
    description: "Read the latest messages in a conversation.",
    kind: "read",
    input: { conversation, limit: z.number().int().min(1).max(100).default(20) },
    handler: ({ conversation: id, limit }) => readConversation(userId, id, limit),
  });

  defineTool(server, {
    name: "send_message",
    title: "Send message",
    description: "Send a LinkedIn message to a connection (by profile) or reply in an existing conversation.",
    kind: "write",
    input: {
      text: z.string().min(1).max(8000),
      profile: z.string().min(2).optional().describe("Profile URL or public id of the recipient"),
      conversation: conversation.optional(),
    },
    handler: ({ text, profile, conversation: id }) => {
      if (id) return sendMessage(userId, { conversation: id }, text);
      if (profile) return sendMessage(userId, { profile }, text);
      throw new ToolError("Provide either profile or conversation.");
    },
  });
}

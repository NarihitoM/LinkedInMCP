import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { publishPost, removePost } from "./posts.service.ts";

const postId = z.string().min(1).describe("Post URN (urn:li:share:..., urn:li:ugcPost:..., urn:li:activity:...) or post URL");

export function registerPostsTools(server: McpServer, context: ToolContext): void {
  defineTool(server, {
    name: "create_post",
    title: "Create post",
    description:
      "Publish a post on the user's LinkedIn feed through the official API. Supports plain text, one image (URL or base64), or a link preview. #hashtags become real hashtags.",
    kind: "write",
    input: {
      text: z.string().min(1).max(3000).describe("Post text, up to 3000 characters"),
      visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
      imageUrl: z.url().optional().describe("Public URL of a JPEG, PNG or GIF to attach"),
      imageBase64: z.string().optional().describe("Base64 image data, as an alternative to imageUrl"),
      imageMimeType: z.enum(["image/jpeg", "image/png", "image/gif"]).optional(),
      imageAltText: z.string().max(4086).optional(),
      articleUrl: z.url().optional().describe("Link to show as an article preview"),
      articleTitle: z.string().max(400).optional(),
      articleDescription: z.string().max(4086).optional(),
    },
    handler: (args) => publishPost(context, args),
  });

  defineTool(server, {
    name: "delete_post",
    title: "Delete post",
    description: "Delete one of the user's own posts through the official API.",
    kind: "destructive",
    input: { post: postId },
    handler: async ({ post }) => {
      await removePost(context, post);
      return "Post deleted.";
    },
  });
}

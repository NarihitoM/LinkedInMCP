import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { REACTIONS, type Reaction } from "./posts.selectors.ts";
import { commentOnPost, getPostStats, listMyPosts, publishPost, reactToPost, removePost } from "./posts.service.ts";

const postId = z.string().min(1).describe("Post URN (urn:li:share:..., urn:li:ugcPost:..., urn:li:activity:...) or post URL");
const reactionNames = Object.keys(REACTIONS) as [Reaction, ...Reaction[]];

export function registerPostsTools(server: McpServer, context: ToolContext, options: { browser: boolean }): void {
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

  if (!options.browser) return;

  defineTool(server, {
    name: "list_my_posts",
    title: "List my posts",
    description: "List the user's recent posts and activity with their URNs, text and engagement counts.",
    kind: "read",
    input: { limit: z.number().int().min(1).max(50).default(10) },
    handler: ({ limit }) => listMyPosts(context.userId, limit),
  });

  defineTool(server, {
    name: "get_post_stats",
    title: "Get post stats",
    description: "Read reactions, comments, reposts and (for the user's own posts) impressions of a post.",
    kind: "read",
    input: { post: postId },
    handler: ({ post }) => getPostStats(context.userId, post),
  });

  defineTool(server, {
    name: "comment_on_post",
    title: "Comment on post",
    description: "Write a comment on any LinkedIn post as the user.",
    kind: "write",
    input: { post: postId, text: z.string().min(1).max(1250) },
    handler: ({ post, text }) => commentOnPost(context.userId, post, text),
  });

  defineTool(server, {
    name: "react_to_post",
    title: "React to post",
    description: "React to a LinkedIn post (like, celebrate, support, love, insightful, funny).",
    kind: "write",
    input: { post: postId, reaction: z.enum(reactionNames).default("like") },
    handler: ({ post, reaction }) => reactToPost(context.userId, post, reaction),
  });
}

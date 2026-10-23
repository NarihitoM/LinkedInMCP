import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../../shared/types/tool.ts";
import { defineTool } from "../../shared/utils/defineTool.ts";
import { PROFILE_SECTIONS } from "../profile/index.ts";
import {
  getProfile,
  listConnections,
  listInvitations,
  removeConnection,
  respondToInvitation,
  searchPeople,
  sendConnectionRequest,
  setFollowing,
  withdrawInvitation,
} from "./network.service.ts";

const profile = z.string().min(2).describe("Profile URL (https://www.linkedin.com/in/someone/) or public id (someone)");

export function registerNetworkTools(server: McpServer, context: ToolContext): void {
  const { userId } = context;

  defineTool(server, {
    name: "search_people",
    title: "Search people",
    description:
      "Search LinkedIn members. Put names, titles, companies or places in keywords. Returns about 10 results per page.",
    kind: "read",
    input: {
      keywords: z.string().min(1).max(200),
      degrees: z.array(z.enum(["first", "second", "third"])).optional().describe("Connection degree filter"),
      page: z.number().int().min(1).max(100).default(1),
    },
    handler: (search) => searchPeople(userId, search),
  });

  defineTool(server, {
    name: "get_profile",
    title: "Get profile",
    description: "Read another member's profile: top card, about, experience, education and skills.",
    kind: "read",
    input: { profile, sections: z.array(z.enum(PROFILE_SECTIONS)).default(["about", "experience"]) },
    handler: ({ profile: target, sections }) => getProfile(userId, target, sections),
  });

  defineTool(server, {
    name: "send_connection_request",
    title: "Send connection request",
    description: "Invite a member to connect, optionally with a personal note (free accounts have a monthly note limit).",
    kind: "write",
    input: { profile, note: z.string().min(1).max(300).optional() },
    handler: ({ profile: target, note }) => sendConnectionRequest(userId, target, note),
  });

  defineTool(server, {
    name: "list_invitations",
    title: "List invitations",
    description: "List pending connection invitations the user received or sent.",
    kind: "read",
    input: { direction: z.enum(["received", "sent"]).default("received"), limit: z.number().int().min(1).max(100).default(20) },
    handler: ({ direction, limit }) => listInvitations(userId, direction, limit),
  });

  defineTool(server, {
    name: "accept_invitation",
    title: "Accept invitation",
    description: "Accept a received connection invitation from the given member.",
    kind: "write",
    input: { profile },
    handler: ({ profile: target }) => respondToInvitation(userId, target, "accept"),
  });

  defineTool(server, {
    name: "ignore_invitation",
    title: "Ignore invitation",
    description: "Ignore a received connection invitation from the given member.",
    kind: "write",
    input: { profile },
    handler: ({ profile: target }) => respondToInvitation(userId, target, "ignore"),
  });

  defineTool(server, {
    name: "withdraw_invitation",
    title: "Withdraw invitation",
    description: "Withdraw a connection invitation the user sent.",
    kind: "destructive",
    input: { profile },
    handler: ({ profile: target }) => withdrawInvitation(userId, target),
  });

  defineTool(server, {
    name: "list_connections",
    title: "List connections",
    description: "List the user's connections, most recently added first.",
    kind: "read",
    input: { limit: z.number().int().min(1).max(200).default(40) },
    handler: ({ limit }) => listConnections(userId, limit),
  });

  defineTool(server, {
    name: "remove_connection",
    title: "Remove connection",
    description: "Remove a member from the user's connections.",
    kind: "destructive",
    input: { profile },
    handler: ({ profile: target }) => removeConnection(userId, target),
  });

  defineTool(server, {
    name: "follow",
    title: "Follow",
    description: "Follow a member (profile URL or id) or a company (company URL).",
    kind: "write",
    input: { target: z.string().min(2).describe("Profile URL/id or company URL") },
    handler: ({ target }) => setFollowing(userId, target, true),
  });

  defineTool(server, {
    name: "unfollow",
    title: "Unfollow",
    description: "Unfollow a member (profile URL or id) or a company (company URL).",
    kind: "write",
    input: { target: z.string().min(2).describe("Profile URL/id or company URL") },
    handler: ({ target }) => setFollowing(userId, target, false),
  });
}

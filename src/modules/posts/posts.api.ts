import { z } from "zod";
import { getEnv } from "../../shared/lib/env.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import type { ImageFile } from "../../shared/utils/safeFetch.ts";

const API_URL = "https://api.linkedin.com/rest";

const initializeUploadSchema = z.object({
  value: z.object({ uploadUrl: z.string(), image: z.string() }),
});

const imageStatusSchema = z.object({ status: z.string().optional() });

export type Visibility = "PUBLIC" | "CONNECTIONS";

export type PostContent =
  | { media: { id: string; altText?: string } }
  | { article: { source: string; title: string; description?: string } };

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": getEnv().LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function failure(response: Response, action: string): Promise<ToolError> {
  const body = await response.text().catch(() => "");
  if (response.status === 401) {
    return new ToolError("LinkedIn rejected the access token. Reconnect the LinkedIn MCP server in Claude to sign in again.");
  }
  if (response.status === 403) {
    return new ToolError(
      `LinkedIn refused to ${action} (HTTP 403). Make sure the app has the "Share on LinkedIn" product and the w_member_social scope. ${body}`,
    );
  }
  if (response.status === 426) {
    return new ToolError(`LinkedIn API version ${getEnv().LINKEDIN_API_VERSION} is no longer active. Set a newer LINKEDIN_API_VERSION.`);
  }
  return new ToolError(`LinkedIn could not ${action} (HTTP ${response.status}): ${body.slice(0, 500)}`);
}

export async function uploadImage(accessToken: string, ownerUrn: string, image: ImageFile): Promise<string> {
  const initialize = await fetch(`${API_URL}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!initialize.ok) throw await failure(initialize, "start the image upload");

  const { value } = initializeUploadSchema.parse(await initialize.json());
  const upload = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": image.mimeType },
    body: new Uint8Array(image.buffer),
    signal: AbortSignal.timeout(60_000),
  });
  if (!upload.ok) throw await failure(upload, "upload the image");

  await waitForImage(accessToken, value.image);
  return value.image;
}

async function waitForImage(accessToken: string, imageUrn: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${API_URL}/images/${encodeURIComponent(imageUrn)}`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const { status } = imageStatusSchema.parse(await response.json());
      if (status === "AVAILABLE") return;
      if (status === "PROCESSING_FAILED") throw new ToolError("LinkedIn could not process the image.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export async function createPost(
  accessToken: string,
  authorUrn: string,
  commentary: string,
  visibility: Visibility,
  content?: PostContent,
): Promise<string> {
  const response = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      author: authorUrn,
      commentary,
      visibility,
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw await failure(response, "publish the post");

  const urn = response.headers.get("x-restli-id");
  if (!urn) throw new ToolError("LinkedIn accepted the post but did not return its id.");
  return urn;
}

export async function deletePost(accessToken: string, postUrn: string): Promise<void> {
  const response = await fetch(`${API_URL}/posts/${encodeURIComponent(postUrn)}`, {
    method: "DELETE",
    headers: { ...headers(accessToken), "X-RestLi-Method": "DELETE" },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) throw new ToolError("Post not found. It may already be deleted.");
  if (!response.ok) throw await failure(response, "delete the post");
}

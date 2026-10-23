import type { ToolContext } from "../../shared/types/tool.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { toCommentary } from "../../shared/utils/littleText.ts";
import { loadImage } from "../../shared/utils/safeFetch.ts";
import { getLinkedInAccess } from "../auth/index.ts";
import { createPost, deletePost, uploadImage, type PostContent, type Visibility } from "./posts.api.ts";

const POST_URN = /urn:li:(?:share|ugcPost|activity):\d+/;

export interface NewPost {
  text: string;
  visibility: Visibility;
  imageUrl?: string | undefined;
  imageBase64?: string | undefined;
  imageMimeType?: string | undefined;
  imageAltText?: string | undefined;
  articleUrl?: string | undefined;
  articleTitle?: string | undefined;
  articleDescription?: string | undefined;
}

export function normalizePostUrn(value: string): string {
  const match = decodeURIComponent(value).match(POST_URN);
  if (!match) throw new ToolError("Provide a post URN like urn:li:share:123 or a LinkedIn post URL that contains one.");
  return match[0];
}

export function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

export async function publishPost(context: ToolContext, post: NewPost) {
  const { accessToken, personUrn } = getLinkedInAccess(context);
  const hasImage = Boolean(post.imageUrl || post.imageBase64);

  if (hasImage && post.articleUrl) {
    throw new ToolError("A post can have an image or a link preview, not both.");
  }

  let content: PostContent | undefined;
  if (hasImage) {
    const image = await loadImage({ imageUrl: post.imageUrl, imageBase64: post.imageBase64, mimeType: post.imageMimeType });
    const imageUrn = await uploadImage(accessToken, personUrn, image);
    content = { media: { id: imageUrn, ...(post.imageAltText ? { altText: post.imageAltText } : {}) } };
  } else if (post.articleUrl) {
    content = {
      article: {
        source: post.articleUrl,
        title: post.articleTitle ?? post.articleUrl,
        ...(post.articleDescription ? { description: post.articleDescription } : {}),
      },
    };
  }

  const urn = await createPost(accessToken, personUrn, toCommentary(post.text), post.visibility, content);
  return { urn, url: postUrl(urn) };
}

export async function removePost(context: ToolContext, urn: string): Promise<void> {
  const postUrn = normalizePostUrn(urn);
  const { accessToken } = getLinkedInAccess(context);
  await deletePost(accessToken, postUrn);
}

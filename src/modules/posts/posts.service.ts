import type { Page } from "playwright";
import { cleanLines } from "../../shared/lib/pageExtract.ts";
import { click, fill, find, findVisible, open, pause, scrollToBottom } from "../../shared/lib/pageActions.ts";
import type { ToolContext } from "../../shared/types/tool.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { toCommentary } from "../../shared/utils/littleText.ts";
import { loadImage } from "../../shared/utils/safeFetch.ts";
import { getLinkedInAccess } from "../auth/index.ts";
import { withLinkedIn } from "../session/index.ts";
import { createPost, deletePost, uploadImage, type PostContent, type Visibility } from "./posts.api.ts";
import { postSelectors, REACTIONS, type Reaction } from "./posts.selectors.ts";

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

export function listMyPosts(userId: string, limit: number) {
  return withLinkedIn(userId, async ({ page, me }) => {
    await open(page, `/in/${me}/recent-activity/all/`);
    await scrollToBottom(page, Math.min(6, Math.ceil(limit / 4)));

    const posts = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-urn^="urn:li:activity:"]')).map((element) => ({
        urn: element.dataset.urn ?? "",
        text:
          element.querySelector<HTMLElement>(".update-components-text, .feed-shared-update-v2__description")?.innerText ??
          "",
        social: element.querySelector<HTMLElement>(".social-details-social-counts")?.innerText ?? "",
        header: element.querySelector<HTMLElement>(".update-components-actor, .update-components-header")?.innerText ?? "",
      })),
    );

    return posts.slice(0, limit).map((post) => ({
      urn: post.urn,
      url: postUrl(post.urn),
      text: cleanLines(post.text, 60).join("\n"),
      header: cleanLines(post.header, 4),
      engagement: cleanLines(post.social, 6),
    }));
  });
}

async function openPost(page: Page, urn: string): Promise<void> {
  await open(page, `/feed/update/${urn}/`);
}

export function getPostStats(userId: string, urn: string) {
  const postUrn = normalizePostUrn(urn);
  return withLinkedIn(userId, async ({ page }) => {
    await openPost(page, postUrn);
    const details = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("main") ?? document.body;
      const social = root.querySelector<HTMLElement>(".social-details-social-counts")?.innerText ?? "";
      const analytics = Array.from(root.querySelectorAll<HTMLElement>("a, span"))
        .map((element) => element.innerText)
        .filter((text) => /impressions?/i.test(text))
        .slice(0, 3);
      const text = root.querySelector<HTMLElement>(".update-components-text")?.innerText ?? "";
      return { social, analytics, text };
    });

    return {
      urn: postUrn,
      url: postUrl(postUrn),
      text: cleanLines(details.text, 60).join("\n"),
      engagement: cleanLines(details.social, 8),
      analytics: details.analytics.flatMap((text) => cleanLines(text, 2)),
    };
  });
}

export function commentOnPost(userId: string, urn: string, text: string) {
  const postUrn = normalizePostUrn(urn);
  return withLinkedIn(userId, async ({ page }) => {
    await openPost(page, postUrn);
    if (!(await findVisible(page, postSelectors.commentBox, 2_000))) {
      await click(page, postSelectors.commentButton, "the Comment button");
    }
    await fill(page, postSelectors.commentBox, "the comment box", text);
    await pause(page, 400, 900);
    await click(page, postSelectors.commentSubmit, "the button that posts the comment");
    await pause(page, 1_500, 2_500);
    return { posted: true, url: postUrl(postUrn) };
  });
}

export function reactToPost(userId: string, urn: string, reaction: Reaction) {
  const postUrn = normalizePostUrn(urn);
  return withLinkedIn(userId, async ({ page }) => {
    await openPost(page, postUrn);
    const likeButton = await find(page, postSelectors.likeButton, "the Like button");

    if (reaction === "like") {
      if ((await likeButton.getAttribute("aria-pressed")) === "true") {
        return { reaction, changed: false, note: "You had already reacted to this post." };
      }
      await likeButton.click();
    } else {
      await likeButton.hover();
      await pause(page, 900, 1_400);
      await click(page, postSelectors.reactionOption(REACTIONS[reaction]), `the ${REACTIONS[reaction]} reaction`);
    }

    await pause(page);
    return { reaction, changed: true };
  });
}

import type { Page } from "playwright";
import { cleanLines, extractLinkedItems } from "../../shared/lib/pageExtract.ts";
import { click, find, findVisible, open, pause, scrollToBottom } from "../../shared/lib/pageActions.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { profileId, threadId } from "../../shared/utils/linkedinIds.ts";
import { withLinkedIn } from "../session/index.ts";
import { messagingSelectors as select } from "./messaging.selectors.ts";

const THREAD_LINK = /linkedin\.com\/messaging\/thread\/[^/?#]+/;

export type Recipient = { profile: string } | { conversation: string };

function threadFromUrl(url: string): string | null {
  const match = url.match(/messaging\/thread\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function listConversations(userId: string, limit: number, unreadOnly: boolean) {
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, unreadOnly ? "/messaging/?filter=unread" : "/messaging/");
    await scrollToBottom(page, Math.ceil(limit / 15));
    const items = await extractLinkedItems(page, THREAD_LINK, limit);
    return items.map((item) => ({
      conversationId: threadFromUrl(item.url),
      url: item.url,
      title: item.lines[0] ?? item.title,
      preview: item.lines.slice(1, 5),
    }));
  });
}

async function readOpenThread(page: Page, limit: number) {
  const list = await find(page, select.messageList, "the message list");
  const events = await list.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>(":scope > li")).map((item) => item.innerText),
  );
  const title = await findVisible(page, select.threadTitle, 2_000);
  return {
    conversationId: threadFromUrl(page.url()),
    with: title ? cleanLines(await title.innerText(), 1)[0] ?? null : null,
    messages: events.map((text) => cleanLines(text, 30)).filter((lines) => lines.length > 0).slice(-limit),
  };
}

export function readConversation(userId: string, conversation: string, limit: number) {
  const id = threadId(conversation);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/messaging/thread/${encodeURIComponent(id)}/`);
    return readOpenThread(page, limit);
  });
}

export function sendMessage(userId: string, recipient: Recipient, text: string) {
  const path =
    "conversation" in recipient
      ? `/messaging/thread/${encodeURIComponent(threadId(recipient.conversation))}/`
      : `/in/${encodeURIComponent(profileId(recipient.profile))}/`;

  return withLinkedIn(userId, async ({ page }) => {
    await open(page, path);
    if (!("conversation" in recipient)) {
      const button = await findVisible(page, select.messageButton, 4_000);
      if (!button) {
        throw new ToolError("There is no Message button on this profile. You may need to connect first or use InMail.");
      }
      await button.click();
      await pause(page, 1_200, 2_000);
    }

    const composer = await find(page, select.composer, "the message box");
    await composer.click();
    await composer.fill(text);
    await pause(page, 400, 900);
    await click(page, select.send, "the Send button");
    await pause(page, 1_200, 2_000);

    const leftover = (await composer.innerText().catch(() => "")).trim();
    if (leftover.length > 0 && leftover === text.trim()) {
      throw new ToolError("LinkedIn did not send the message. The recipient may not accept messages from you.");
    }
    return { sent: true, conversationId: threadFromUrl(page.url()) };
  });
}

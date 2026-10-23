import type { Locator, Page } from "playwright";
import { extractLinkedItems, normalizeUrl } from "../../shared/lib/pageExtract.ts";
import { click, find, findVisible, open, pause, scrollToBottom, type Finder } from "../../shared/lib/pageActions.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { companySlug, profileId } from "../../shared/utils/linkedinIds.ts";
import { readProfile, type ProfileSection } from "../profile/index.ts";
import { withLinkedIn } from "../session/index.ts";
import { networkSelectors as select } from "./network.selectors.ts";

const PROFILE_LINK = /linkedin\.com\/in\/[^/?#]+/;
const DEGREE_FILTER = { first: "F", second: "S", third: "O" } as const;

export type Degree = keyof typeof DEGREE_FILTER;

export interface PeopleSearch {
  keywords: string;
  degrees?: Degree[] | undefined;
  page: number;
}

export function searchPeople(userId: string, search: PeopleSearch) {
  return withLinkedIn(userId, async ({ page }) => {
    const params = new URLSearchParams({ keywords: search.keywords, origin: "GLOBAL_SEARCH_HEADER" });
    if (search.degrees?.length) {
      params.set("network", JSON.stringify(search.degrees.map((degree) => DEGREE_FILTER[degree])));
    }
    if (search.page > 1) params.set("page", String(search.page));

    await open(page, `/search/results/people/?${params.toString()}`);
    await scrollToBottom(page, 2);
    const results = await extractLinkedItems(page, PROFILE_LINK, 10);
    return results.map((result) => ({ name: result.title, profileUrl: result.url, details: result.lines.slice(0, 6) }));
  });
}

export function getProfile(userId: string, profile: string, sections: readonly ProfileSection[]) {
  const id = profileId(profile);
  return withLinkedIn(userId, ({ page }) => readProfile(page, id, sections));
}

async function openMoreMenuItem(page: Page, item: Finder[]): Promise<boolean> {
  const more = await findVisible(page, select.moreActions, 2_000);
  if (!more) return false;
  await more.click();
  await pause(page, 400, 800);
  const option = await findVisible(page, item, 2_000);
  if (!option) {
    await page.keyboard.press("Escape");
    return false;
  }
  await option.click();
  await pause(page, 400, 800);
  return true;
}

async function visibleDialog(page: Page): Promise<Locator> {
  return find(page, [(scope) => scope.locator('[role="dialog"]:visible').last()], "the dialog");
}

export function sendConnectionRequest(userId: string, profile: string, note?: string) {
  const id = profileId(profile);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/in/${encodeURIComponent(id)}/`);

    if (await findVisible(page, select.pending, 1_500)) {
      throw new ToolError("A connection request to this person is already pending.");
    }

    const direct = await findVisible(page, select.connect, 3_000);
    if (direct) {
      await direct.click();
    } else if (!(await openMoreMenuItem(page, select.menuConnect))) {
      throw new ToolError("There is no Connect option for this profile. You may already be connected, or LinkedIn only allows Follow.");
    }

    await pause(page, 600, 1_000);
    const modal = await visibleDialog(page);
    if (note) {
      await click(modal, select.addNote, "the Add a note button");
      await find(modal, select.noteBox, "the note text box").then((box) => box.fill(note));
      await click(modal, select.sendInvite, "the Send button");
    } else {
      await click(modal, select.sendWithoutNote, "the Send without a note button");
    }

    await pause(page, 1_000, 1_800);
    const stillOpen = await findVisible(page, [(scope) => scope.locator('[role="dialog"]:visible')], 1_000);
    if (stillOpen) {
      const message = (await stillOpen.innerText().catch(() => "")).split("\n").slice(0, 4).join(" ");
      throw new ToolError(`LinkedIn did not send the invitation: ${message}`);
    }
    return { sent: true, profileUrl: normalizeUrl(`/in/${encodeURIComponent(id)}/`), withNote: Boolean(note) };
  });
}

export function listInvitations(userId: string, direction: "received" | "sent", limit: number) {
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/mynetwork/invitation-manager/${direction}/`);
    await scrollToBottom(page, Math.ceil(limit / 10));
    const items = await extractLinkedItems(page, PROFILE_LINK, limit);
    return items.map((item) => ({ name: item.title, profileUrl: item.url, details: item.lines.slice(0, 5) }));
  });
}

async function invitationRow(page: Page, id: string): Promise<Locator> {
  const row = page
    .locator("main li")
    .filter({ has: page.locator(`a[href*="/in/${id}"]`) })
    .first();
  if (!(await row.isVisible().catch(() => false))) {
    throw new ToolError(`No invitation from or to ${id} was found.`);
  }
  return row;
}

export function respondToInvitation(userId: string, profile: string, action: "accept" | "ignore") {
  const id = profileId(profile);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, "/mynetwork/invitation-manager/received/");
    const row = await invitationRow(page, id);
    await click(row, action === "accept" ? select.accept : select.ignore, `the ${action} button`);
    await pause(page);
    return { [action === "accept" ? "accepted" : "ignored"]: id };
  });
}

export function withdrawInvitation(userId: string, profile: string) {
  const id = profileId(profile);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, "/mynetwork/invitation-manager/sent/");
    const row = await invitationRow(page, id);
    await click(row, select.withdraw, "the Withdraw button");
    await pause(page, 500, 900);
    await click(await visibleDialog(page), select.confirmWithdraw, "the Withdraw confirmation");
    await pause(page);
    return { withdrawn: id };
  });
}

export function listConnections(userId: string, limit: number) {
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, "/mynetwork/invite-connect/connections/");
    await scrollToBottom(page, Math.min(10, Math.ceil(limit / 10)));
    const items = await extractLinkedItems(page, PROFILE_LINK, limit);
    return items.map((item) => ({ name: item.title || item.lines[0] || "", profileUrl: item.url, details: item.lines.slice(0, 4) }));
  });
}

export function removeConnection(userId: string, profile: string) {
  const id = profileId(profile);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, `/in/${encodeURIComponent(id)}/`);
    if (!(await openMoreMenuItem(page, select.removeConnection))) {
      throw new ToolError("There is no Remove connection option. You may not be connected to this person.");
    }
    await click(await visibleDialog(page), select.confirmRemove, "the Remove confirmation");
    await pause(page);
    return { removed: id };
  });
}

function followTarget(target: string): string {
  if (/linkedin\.com\/(company|school)\//i.test(target)) return `/company/${encodeURIComponent(companySlug(target))}/`;
  return `/in/${encodeURIComponent(profileId(target))}/`;
}

export function setFollowing(userId: string, target: string, follow: boolean) {
  const path = followTarget(target);
  return withLinkedIn(userId, async ({ page }) => {
    await open(page, path);

    if (follow) {
      if (await findVisible(page, select.following, 1_500)) return { following: true, changed: false };
      const button = await findVisible(page, select.follow, 3_000);
      if (button) {
        await button.click();
      } else if (!(await openMoreMenuItem(page, select.menuFollow))) {
        throw new ToolError("There is no Follow option on this page.");
      }
    } else {
      const button = await findVisible(page, select.following, 3_000);
      if (button) {
        await button.click();
      } else if (!(await openMoreMenuItem(page, select.menuUnfollow))) {
        return { following: false, changed: false };
      }
      const confirm = await findVisible(page, select.confirmUnfollow, 2_000);
      if (confirm) await confirm.click();
    }

    await pause(page);
    return { following: follow, changed: true, url: normalizeUrl(path) };
  });
}

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Locator, Page } from "playwright";
import { LoginWallError, ToolError } from "../utils/errors.ts";
import { getEnv } from "./env.ts";

export const LINKEDIN_URL = "https://www.linkedin.com";

export type Scope = Page | Locator;
export type Finder = (scope: Scope) => Locator;

const LOGIN_WALL = /linkedin\.com\/(login|authwall|checkpoint|uas\/login|signup)/i;
const FIND_TIMEOUT_MS = 10_000;
const POLL_MS = 250;

export function isLoginWall(url: string): boolean {
  return LOGIN_WALL.test(url);
}

export function linkedInUrl(path: string): string {
  const url = new URL(path, LINKEDIN_URL);
  if (url.origin !== LINKEDIN_URL) {
    throw new ToolError(`Refusing to open a non-LinkedIn URL: ${url.origin}`);
  }
  return url.toString();
}

export async function pause(page: Page, minMs = 600, maxMs = 1400): Promise<void> {
  await page.waitForTimeout(minMs + Math.floor(Math.random() * (maxMs - minMs)));
}

export async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(linkedInUrl(path), { waitUntil: "commit", timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  const ready = await page
    .locator("main")
    .first()
    .waitFor({ state: "attached", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (isLoginWall(page.url())) {
    throw new LoginWallError(page.url());
  }
  if (!ready) {
    if (response?.status() === 999) {
      throw new ToolError("LinkedIn blocked this request (HTTP 999). Wait a while before retrying, or set a residential proxy.");
    }
    throw new ToolError(`LinkedIn did not finish loading ${page.url()}. Try again in a moment.`);
  }
  await pause(page);
}

export async function findVisible(scope: Scope, finders: Finder[], timeoutMs = FIND_TIMEOUT_MS): Promise<Locator | undefined> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const finder of finders) {
      const candidate = finder(scope).first();
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  } while (Date.now() < deadline);
  return undefined;
}

export async function find(scope: Scope, finders: Finder[], description: string, timeoutMs?: number): Promise<Locator> {
  const locator = await findVisible(scope, finders, timeoutMs);
  if (!locator) {
    throw new ToolError(
      `Could not find ${description} on LinkedIn. The layout may have changed, or the account's display language is not English.`,
    );
  }
  return locator;
}

export async function click(scope: Scope, finders: Finder[], description: string, timeoutMs?: number): Promise<void> {
  const locator = await find(scope, finders, description, timeoutMs);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click();
}

export async function fill(scope: Scope, finders: Finder[], description: string, value: string): Promise<void> {
  const locator = await find(scope, finders, description);
  await locator.fill(value);
}

export async function fillTypeahead(page: Page, scope: Scope, finders: Finder[], description: string, value: string): Promise<void> {
  const input = await find(scope, finders, description);
  await input.fill("");
  await input.pressSequentially(value, { delay: 40 });
  const option = await findVisible(page, [(root) => root.getByRole("option")], 4_000);
  if (option) {
    await option.click();
  } else {
    await input.press("Tab");
  }
}

export async function selectByLabel(scope: Scope, finders: Finder[], description: string, label: string): Promise<void> {
  const select = await find(scope, finders, description);
  await select.selectOption({ label });
}

export async function setChecked(scope: Scope, finders: Finder[], description: string, checked: boolean): Promise<void> {
  const box = await find(scope, finders, description);
  if ((await box.isChecked()) !== checked) {
    await box.click({ force: true });
  }
}

export async function scrollToBottom(page: Page, rounds: number): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await page.mouse.wheel(0, 2500);
    await pause(page, 700, 1300);
  }
}

export async function captureScreenshot(page: Page, label: string): Promise<string | undefined> {
  try {
    const directory = join(getEnv().DATA_DIR, "debug");
    await mkdir(directory, { recursive: true });
    const file = join(directory, `${Date.now()}-${label.replace(/[^a-z0-9_-]/gi, "_")}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return undefined;
  }
}

export const byRole =
  (role: Parameters<Page["getByRole"]>[0], name: RegExp | string): Finder =>
  (scope) =>
    scope.getByRole(role, { name });

export const byLabel =
  (label: RegExp | string): Finder =>
  (scope) =>
    scope.getByLabel(label);

export const byCss =
  (selector: string): Finder =>
  (scope) =>
    scope.locator(selector);

export const dialog: Finder[] = [byCss('[role="dialog"]:visible'), byCss(".artdeco-modal:visible")];

export async function openDialog(page: Page): Promise<Locator> {
  return find(page, dialog, "the edit dialog");
}

export async function saveDialog(page: Page, modal: Locator, buttonName: RegExp = /^Save$/i): Promise<void> {
  await click(modal, [byRole("button", buttonName)], "the Save button");
  const closed = await modal
    .waitFor({ state: "hidden", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!closed) {
    const errors = await modal
      .locator('[role="alert"], .artdeco-inline-feedback--error')
      .allInnerTexts()
      .catch(() => []);
    const detail = errors.map((text) => text.trim()).filter(Boolean).join("; ");
    throw new ToolError(`LinkedIn did not accept the changes${detail ? `: ${detail}` : "."}`);
  }
  await pause(page);
}

import type { Page } from "playwright";

export interface ExtractedItem {
  lines: string[];
  links: string[];
}

export interface LinkedItem {
  url: string;
  title: string;
  lines: string[];
}

export function cleanLines(text: string, maxLines = 40): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || line === lines[lines.length - 1]) continue;
    if (/^(Show all|Show more|See more|…see more|Show credential)\b/i.test(line)) continue;
    lines.push(line);
    if (lines.length >= maxLines) break;
  }
  return lines;
}

export function normalizeUrl(href: string): string {
  const url = new URL(href, "https://www.linkedin.com");
  return `${url.origin}${url.pathname}`;
}

export async function extractTopLevelItems(page: Page, rootSelector = "main"): Promise<ExtractedItem[]> {
  const raw = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    return Array.from(root.querySelectorAll("li"))
      .filter((item) => !item.parentElement?.closest("li"))
      .map((item) => ({
        text: (item as HTMLElement).innerText,
        links: Array.from(item.querySelectorAll("a[href]")).map((anchor) => (anchor as HTMLAnchorElement).href),
      }))
      .filter((item) => item.text.trim().length > 0);
  }, rootSelector);

  return raw.map((item) => ({ lines: cleanLines(item.text), links: item.links }));
}

export async function extractLinkedItems(page: Page, hrefPattern: RegExp, limit: number): Promise<LinkedItem[]> {
  const raw = await page.evaluate(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      const root = document.querySelector("main") ?? document.body;
      const seen = new Map<string, { href: string; title: string; text: string }>();

      for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
        const match = anchor.href.match(pattern);
        if (!match) continue;
        const key = match[0];
        if (seen.has(key)) continue;
        const container =
          anchor.closest("li") ?? anchor.closest("[data-view-name]") ?? anchor.parentElement?.parentElement ?? anchor;
        const title =
          anchor.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || anchor.textContent?.trim() || "";
        seen.set(key, { href: anchor.href, title, text: (container as HTMLElement).innerText });
      }
      return Array.from(seen.values());
    },
    { source: hrefPattern.source, flags: hrefPattern.flags },
  );

  return raw
    .filter((item) => item.text.trim().length > 0)
    .slice(0, limit)
    .map((item) => ({
      url: normalizeUrl(item.href),
      title: cleanLines(item.title, 1)[0] ?? "",
      lines: cleanLines(item.text, 12),
    }));
}

export async function extractSectionText(page: Page, selector: string, maxLines = 80): Promise<string[]> {
  const text = await page
    .locator(selector)
    .first()
    .innerText({ timeout: 5_000 })
    .catch(() => "");
  return cleanLines(text, maxLines);
}

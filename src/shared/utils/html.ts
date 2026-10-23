import { randomBytes } from "node:crypto";
import type { Response } from "express";

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const BASE_STYLES = `
:root {
  --bg: #f3f2ef;
  --surface: #ffffff;
  --text: #1d2226;
  --muted: #56687a;
  --accent: #0a66c2;
  --danger: #b24020;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
`;

const MESSAGE_STYLES = `
body { display: grid; place-items: center; }
main { max-width: 440px; margin: 16px; padding: 32px; background: var(--surface); border-radius: 12px; box-shadow: 0 1px 3px rgb(0 0 0 / 12%); }
h1 { margin: 0 0 8px; font-size: 20px; }
p { margin: 0; color: var(--muted); }
`;

export interface Page {
  html: string;
  contentSecurityPolicy: string;
}

interface PageOptions {
  title: string;
  body: string;
  styles?: string;
  script?: string;
  connectSrc?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

export function renderPage({ title, body, styles = "", script, connectSrc }: PageOptions): Page {
  const nonce = randomBytes(16).toString("base64");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style nonce="${nonce}">${BASE_STYLES}${styles}</style>
</head>
<body>
${body}
${script ? `<script nonce="${nonce}">${script}</script>` : ""}
</body>
</html>`;

  const contentSecurityPolicy = [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    "img-src data: blob:",
    `connect-src ${connectSrc ?? "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  return { html, contentSecurityPolicy };
}

export function sendPage(res: Response, page: Page, status = 200): void {
  res.setHeader("Content-Security-Policy", page.contentSecurityPolicy);
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).type("html").send(page.html);
}

export function renderMessagePage(title: string, message: string): Page {
  return renderPage({
    title,
    styles: MESSAGE_STYLES,
    body: `<main>\n  <h1>${escapeHtml(title)}</h1>\n  <p>${escapeHtml(message)}</p>\n</main>`,
  });
}

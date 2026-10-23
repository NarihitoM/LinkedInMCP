import { escapeHtml, renderPage, type Page } from "../../shared/utils/html.ts";
import { AGENT_LOGOS, CLIENT_LOGOS, OPENCODE_LOGO } from "./clientLogos.ts";

const REPOSITORY_URL = "https://github.com/NarihitoM/LinkedInMCP";
const AUTHOR_URL = "https://github.com/NarihitoM";

interface GuideStep {
  text: string;
  code?: { file?: string; value: string };
}

interface ClientGuide {
  id: string;
  name: string;
  logo: string;
  summary: string;
  steps: GuideStep[];
}

interface ToolGroup {
  name: string;
  tools: string[];
}

const LINKEDIN_MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>`;

const SIGN_IN_STEP = "Sign in with LinkedIn in the browser window that opens and select <strong>Allow</strong>.";

const API_TOOLS: ToolGroup[] = [
  { name: "Account", tools: ["whoami"] },
  { name: "Posts", tools: ["create_post", "delete_post"] },
];

const BROWSER_TOOLS: ToolGroup[] = [
  { name: "Session", tools: ["session_status", "connect_session_link", "disconnect_session", "set_browser_proxy"] },
  {
    name: "Profile",
    tools: [
      "get_my_profile",
      "update_headline",
      "update_about",
      "update_location",
      "update_contact_info",
      "add_experience",
      "update_experience",
      "delete_experience",
      "add_education",
      "update_education",
      "delete_education",
      "add_skills",
      "remove_skill",
      "update_profile_photo",
      "update_banner",
      "set_open_to_work",
    ],
  },
  { name: "Posts", tools: ["list_my_posts", "get_post_stats", "comment_on_post", "react_to_post"] },
  {
    name: "Network",
    tools: [
      "search_people",
      "get_profile",
      "send_connection_request",
      "list_invitations",
      "accept_invitation",
      "ignore_invitation",
      "withdraw_invitation",
      "list_connections",
      "remove_connection",
      "follow",
      "unfollow",
    ],
  },
  { name: "Messaging", tools: ["list_conversations", "read_conversation", "send_message"] },
  { name: "Jobs", tools: ["search_jobs", "get_job", "save_job", "list_saved_jobs", "easy_apply", "get_company", "search_companies"] },
];

function icon(path: string, evenOdd = false): string {
  const rule = evenOdd ? ' fill-rule="evenodd" clip-rule="evenodd"' : "";
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="currentColor"${rule}/></svg>`;
}

function jsonConfig(root: string, entry: Record<string, string>): string {
  return JSON.stringify({ [root]: { linkedin: entry } }, null, 2);
}

function guides(serverUrl: string): ClientGuide[] {
  const url = escapeHtml(serverUrl);

  return [
    {
      id: "claude-code",
      name: "Claude Code",
      logo: icon(CLIENT_LOGOS.claude),
      summary: "Add the server from your terminal, then sign in from inside Claude Code.",
      steps: [
        { text: "Add the server.", code: { value: `claude mcp add --transport http linkedin ${serverUrl}` } },
        { text: "Start Claude Code, run <kbd>/mcp</kbd>, choose <strong>linkedin</strong> and select <strong>Authenticate</strong>." },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      logo: icon(CLIENT_LOGOS.claude),
      summary: "Works in Claude Desktop and on claude.ai with the same steps.",
      steps: [
        { text: "Open <strong>Settings</strong>, then <strong>Connectors</strong>, and select <strong>Add custom connector</strong>." },
        { text: `Name it <strong>LinkedIn</strong> and paste <code>${url}</code> as the URL.` },
        { text: `Select <strong>Connect</strong>. ${SIGN_IN_STEP}` },
      ],
    },
    {
      id: "codex",
      name: "Codex",
      logo: icon(AGENT_LOGOS.codex, true),
      summary: "Add the server to the Codex CLI or IDE extension from your terminal.",
      steps: [
        { text: "Add the server.", code: { value: `codex mcp add linkedin --url ${serverUrl}` } },
        { text: "Sign in.", code: { value: "codex mcp login linkedin" } },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "cursor",
      name: "Cursor",
      logo: icon(CLIENT_LOGOS.cursor),
      summary: "Add the server to your global or project MCP config.",
      steps: [
        {
          text: "Add this to <code>~/.cursor/mcp.json</code>, or to <code>.cursor/mcp.json</code> in a project.",
          code: { file: "mcp.json", value: jsonConfig("mcpServers", { url: serverUrl }) },
        },
        { text: "Open <strong>Settings</strong>, then <strong>MCP</strong>, and select <strong>Login</strong> next to linkedin." },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "vscode",
      name: "VS Code",
      logo: icon(CLIENT_LOGOS.copilot),
      summary: "Use the server from GitHub Copilot agent mode.",
      steps: [
        {
          text: "Add this to <code>.vscode/mcp.json</code> in your workspace.",
          code: { file: ".vscode/mcp.json", value: jsonConfig("servers", { type: "http", url: serverUrl }) },
        },
        { text: "Select <strong>Start</strong> above the server entry and allow the sign-in prompt." },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "windsurf",
      name: "Windsurf",
      logo: icon(AGENT_LOGOS.windsurf, true),
      summary: "Add the server to your Windsurf MCP config.",
      steps: [
        {
          text: "In Cascade, select the <strong>MCPs</strong> icon, then <strong>Configure</strong>, and add this to <code>mcp_config.json</code>.",
          code: { file: "~/.codeium/windsurf/mcp_config.json", value: jsonConfig("mcpServers", { serverUrl }) },
        },
        { text: "Save the file and refresh the MCP list." },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      logo: icon(AGENT_LOGOS.gemini, true),
      summary: "Add the server from your terminal, then sign in from inside Gemini CLI.",
      steps: [
        { text: "Add the server.", code: { value: `gemini mcp add --transport http linkedin ${serverUrl}` } },
        { text: "Start Gemini CLI and run <kbd>/mcp auth linkedin</kbd>." },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "opencode",
      name: "OpenCode",
      logo: OPENCODE_LOGO,
      summary: "Add a remote server to your OpenCode config.",
      steps: [
        {
          text: "Add this to <code>opencode.json</code>.",
          code: {
            file: "opencode.json",
            value: JSON.stringify(
              { $schema: "https://opencode.ai/config.json", mcp: { linkedin: { type: "remote", url: serverUrl, enabled: true } } },
              null,
              2,
            ),
          },
        },
        { text: "Sign in.", code: { value: "opencode mcp auth linkedin" } },
        { text: SIGN_IN_STEP },
      ],
    },
    {
      id: "other",
      name: "Other clients",
      logo: icon(CLIENT_LOGOS.mcp),
      summary:
        "Any client that supports remote MCP servers with OAuth can use the URL directly. For clients that only run local servers, use mcp-remote.",
      steps: [
        {
          text: "Add this to your client's MCP config. Node.js 18 or newer is required.",
          code: {
            file: "mcp.json",
            value: JSON.stringify({ mcpServers: { linkedin: { command: "npx", args: ["-y", "mcp-remote", serverUrl] } } }, null, 2),
          },
        },
        { text: "Restart the client." },
        { text: SIGN_IN_STEP },
      ],
    },
  ];
}

function codeBlock(id: string, code: NonNullable<GuideStep["code"]>): string {
  return `<div class="snippet">
  <div class="snippet-bar">
    <span>${code.file ? escapeHtml(code.file) : "Terminal"}</span>
    <button type="button" class="copy" data-copy="${id}">Copy</button>
  </div>
  <pre id="${id}"><code>${escapeHtml(code.value)}</code></pre>
</div>`;
}

function renderTabs(list: ClientGuide[]): string {
  return list
    .map(
      (guide, index) => `<button type="button" role="tab" id="tab-${guide.id}" aria-controls="panel-${guide.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">
  <span class="tab-logo">${guide.logo}</span>${escapeHtml(guide.name)}
</button>`,
    )
    .join("");
}

function renderPanels(list: ClientGuide[]): string {
  return list
    .map(
      (guide, index) => `<div role="tabpanel" id="panel-${guide.id}" aria-labelledby="tab-${guide.id}" tabindex="0"${index === 0 ? "" : " hidden"}>
  <p class="panel-summary">${escapeHtml(guide.summary)}</p>
  <ol class="guide">
    ${guide.steps
      .map((step, stepIndex) => `<li><p>${step.text}</p>${step.code ? codeBlock(`code-${guide.id}-${stepIndex}`, step.code) : ""}</li>`)
      .join("")}
  </ol>
</div>`,
    )
    .join("");
}

function renderToolGroups(groups: ToolGroup[]): string {
  return groups
    .map(
      (group) => `<div class="tool-group">
  <h4>${escapeHtml(group.name)}</h4>
  <div class="tools">${group.tools.map((tool) => `<code>${escapeHtml(tool)}</code>`).join("")}</div>
</div>`,
    )
    .join("");
}

function renderTools(browserEnabled: boolean): string {
  if (browserEnabled) {
    return `<div class="tool-card">
  <div class="tool-card-head"><h3>All tools</h3><span class="badge on">Available on this server</span></div>
  ${renderToolGroups([...API_TOOLS, ...BROWSER_TOOLS])}
</div>`;
  }

  return `<div class="tool-card">
  <div class="tool-card-head"><h3>Official API</h3><span class="badge on">Available on this server</span></div>
  ${renderToolGroups(API_TOOLS)}
</div>
<div class="tool-card muted-card">
  <div class="tool-card-head"><h3>Browser tools</h3><span class="badge">Run it yourself</span></div>
  <p class="tool-note">These drive a private headless browser logged in as you, so they need a server that can run Chrome. Clone the repository and run <code>npm run dev</code> to turn them on.</p>
  ${renderToolGroups(BROWSER_TOOLS)}
</div>`;
}

const PAGE_STYLES = `
:root {
  --bg: #f4f2ee;
  --surface: #ffffff;
  --text: #1d2226;
  --muted: #5e6b78;
  --border: #dcdad4;
  --accent: #0a66c2;
  --accent-soft: #e2edf8;
  --accent-text: #ffffff;
  --success: #057642;
  --bubble: #eef1f4;
  --mono: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121417;
    --surface: #1b1f23;
    --text: #e8eaed;
    --muted: #9aa5b1;
    --border: #2c3238;
    --accent: #70b5f9;
    --accent-soft: #1c2f44;
    --accent-text: #0b1520;
    --success: #5fcf8f;
    --bubble: #232a31;
    color-scheme: dark;
  }
}
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
[hidden] { display: none !important; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
code { font-family: var(--mono); font-size: 0.9em; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); word-break: break-word; }
.shell { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; color: var(--text); text-decoration: none; }
.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: #0a66c2; color: #ffffff; }
.brand-mark svg { width: 20px; height: 20px; }
.topbar a.source { color: var(--muted); text-decoration: none; font-weight: 500; }
.topbar a.source:hover { color: var(--text); }
.hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 56px; align-items: center; padding: 48px 0 72px; }
.hero > * { min-width: 0; }
.hero h1 { margin: 0 0 18px; font-size: clamp(2.4rem, 5.2vw, 3.7rem); line-height: 1.02; letter-spacing: -0.035em; font-weight: 800; max-width: 12ch; text-wrap: balance; }
.lead { margin: 0 0 32px; font-size: 1.15rem; color: var(--muted); max-width: 46ch; }
.url-label { display: block; font-weight: 600; margin-bottom: 8px; }
.url-box { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; max-width: 520px; }
.url-box code { flex: 1; min-width: 0; padding: 0; border: 0; background: none; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; word-break: normal; }
.copy { font: inherit; font-size: 0.875rem; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; white-space: nowrap; }
.copy:hover { border-color: var(--accent); }
.url-box .copy { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
.url-note { margin: 12px 0 0; color: var(--muted); font-size: 0.95rem; max-width: 48ch; }
.chat { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 22px; display: grid; gap: 12px; box-shadow: 0 24px 48px -32px rgba(15, 30, 46, 0.35); }
.chat-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border); font-weight: 600; }
.chat-head .brand-mark { width: 28px; height: 28px; border-radius: 6px; }
.chat-head .brand-mark svg { width: 16px; height: 16px; }
.chat-head span.status { margin-left: auto; font-size: 0.85rem; font-weight: 500; color: var(--success); }
.bubble { max-width: 88%; padding: 10px 14px; border-radius: 16px; font-size: 0.95rem; }
.bubble p { margin: 0; }
.bubble.you { justify-self: end; background: var(--accent); color: var(--accent-text); border-bottom-right-radius: 4px; }
.bubble.ai { background: var(--bubble); border-bottom-left-radius: 4px; }
.calls { display: flex; flex-wrap: wrap; gap: 6px; }
.call { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.78rem; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.call::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
section.block { padding: 72px 0; border-top: 1px solid var(--border); }
.block h2 { margin: 0 0 10px; font-size: clamp(1.6rem, 3vw, 2.1rem); letter-spacing: -0.025em; line-height: 1.15; }
.block-intro { margin: 0 0 36px; color: var(--muted); max-width: 60ch; font-size: 1.05rem; }
.flow { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; counter-reset: flow; }
.flow li { counter-increment: flow; }
.flow li::before { content: counter(flow); display: grid; place-items: center; width: 36px; height: 36px; margin-bottom: 16px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.flow h3 { margin: 0 0 6px; font-size: 1.1rem; }
.flow p { margin: 0; color: var(--muted); }
.setup { min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
[role="tablist"] { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; border-bottom: 1px solid var(--border); }
[role="tab"] { display: inline-flex; align-items: center; gap: 8px; flex: none; font: inherit; font-weight: 600; font-size: 0.95rem; padding: 10px 14px; border: 0; border-radius: 10px; background: none; color: var(--muted); cursor: pointer; }
[role="tab"]:hover { color: var(--text); background: var(--bg); }
[role="tab"][aria-selected="true"] { background: var(--accent-soft); color: var(--text); }
.tab-logo { display: grid; place-items: center; width: 20px; height: 20px; }
.tab-logo svg { width: 18px; height: 18px; }
[role="tabpanel"] { padding: 28px; }
.panel-summary { margin: 0 0 20px; color: var(--muted); max-width: 64ch; }
.guide { margin: 0; padding: 0 0 0 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.guide li { min-width: 0; }
.guide li::marker { color: var(--accent); font-weight: 700; }
.guide p { margin: 0; }
kbd { font-family: var(--mono); font-size: 0.85em; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border); border-bottom-width: 2px; background: var(--bg); }
.snippet { margin-top: 10px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--bg); max-width: 720px; }
.snippet-bar { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 6px 14px; border-bottom: 1px solid var(--border); font-size: 0.85rem; color: var(--muted); }
.snippet-bar .copy { padding: 5px 12px; font-size: 0.8rem; }
.snippet pre { margin: 0; padding: 14px 16px; overflow-x: auto; font-family: var(--mono); font-size: 0.86rem; line-height: 1.6; }
.snippet pre code { padding: 0; border: 0; background: none; font-size: inherit; word-break: normal; }
.tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 24px 28px; display: grid; gap: 18px; }
.tool-card + .tool-card { margin-top: 20px; }
.tool-card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.tool-card-head h3 { margin: 0; font-size: 1.15rem; }
.badge { font-size: 0.8rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.badge.on { border-color: transparent; background: var(--accent-soft); color: var(--accent); }
.tool-note { margin: 0; color: var(--muted); max-width: 70ch; }
.tool-group h4 { margin: 0 0 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.tools { display: flex; flex-wrap: wrap; gap: 6px; }
.tools code { font-size: 0.82rem; }
.muted-card .tools code { opacity: 0.75; }
.footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 28px 0 40px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.9rem; }
.footer a { color: inherit; }
.footer .author { color: var(--text); font-weight: 600; }
@media (max-width: 860px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: 40px; padding: 24px 0 56px; }
  .flow { grid-template-columns: minmax(0, 1fr); gap: 24px; }
}
@media (max-width: 520px) {
  .shell { padding: 0 16px; }
  .topbar { padding: 14px 0; }
  .hero { gap: 32px; padding: 16px 0 48px; }
  .lead { font-size: 1.05rem; margin-bottom: 24px; }
  .url-box { padding-left: 12px; }
  .url-box code { font-size: 0.85rem; white-space: normal; overflow-wrap: anywhere; line-height: 1.45; }
  .copy { min-height: 36px; }
  .chat { padding: 16px; border-radius: 16px; }
  .bubble { max-width: 92%; }
  section.block { padding: 48px 0; }
  .block-intro { margin-bottom: 24px; font-size: 1rem; }
  .flow li { display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 14px; }
  .flow li::before { grid-row: span 2; margin-bottom: 0; }
  .setup, .tool-card { border-radius: 16px; }
  .tool-card { padding: 20px 16px; }
  [role="tablist"] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  [role="tab"] { min-width: 0; padding: 10px; font-size: 0.9rem; text-align: left; line-height: 1.25; }
  [role="tabpanel"] { padding: 20px 16px; }
  .guide { padding-left: 20px; gap: 16px; }
  .snippet pre { padding: 12px 14px; font-size: 0.8rem; white-space: pre-wrap; overflow-wrap: anywhere; }
  .footer { flex-direction: column; gap: 8px; padding: 24px 0 32px; }
}
`;

const PAGE_SCRIPT = `
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

function select(tab, focus) {
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
  }
  if (focus) tab.focus();
}

const keys = { ArrowRight: 1, ArrowLeft: -1 };
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => select(tab, false));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(tabs[next], true);
  });
});

const initial = tabs.find((tab) => "#" + tab.id.slice(4) === location.hash);
if (initial) {
  select(initial, false);
  document.getElementById("setup").scrollIntoView();
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const source = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(source.textContent.trim());
      button.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = "Press Ctrl+C";
    }
    setTimeout(() => { button.textContent = "Copy"; }, 2000);
  });
}
`;

export function renderHomePage(serverUrl: string, browserEnabled: boolean): Page {
  const list = guides(serverUrl);
  const reach = browserEnabled
    ? "Edit your profile, publish posts, grow your network, message people and apply for jobs from Claude, Codex, Cursor and any other MCP client."
    : "Publish posts and check your account from Claude, Codex, Cursor and any other MCP client.";

  return renderPage({
    title: "LinkedIn MCP",
    styles: PAGE_STYLES,
    script: PAGE_SCRIPT,
    body: `<div class="shell">
<header class="topbar">
  <a class="brand" href="/"><span class="brand-mark">${LINKEDIN_MARK}</span>LinkedIn MCP</a>
  <a class="source" href="${REPOSITORY_URL}" rel="noopener">Source on GitHub</a>
</header>

<main>
  <section class="hero">
    <div>
      <h1>Your LinkedIn, inside your AI tools</h1>
      <p class="lead">${escapeHtml(reach)}</p>
      <span class="url-label">Server URL</span>
      <div class="url-box">
        <code id="server-url">${escapeHtml(serverUrl)}</code>
        <button type="button" class="copy" data-copy="server-url">Copy</button>
      </div>
      <p class="url-note">Sign in once with your LinkedIn account. Your LinkedIn password never touches this server.</p>
    </div>

    <div class="chat" aria-label="Example conversation">
      <div class="chat-head"><span class="brand-mark">${LINKEDIN_MARK}</span>LinkedIn<span class="status">Connected</span></div>
      <div class="bubble you"><p>Post that we just shipped v2 of our app, and tag it #buildinpublic.</p></div>
      <div class="calls"><span class="call">create_post</span></div>
      <div class="bubble ai"><p>Posted to your feed. Here is the link if you want to pin it.</p></div>
      <div class="bubble you"><p>Who am I signed in as?</p></div>
      <div class="calls"><span class="call">whoami</span></div>
      <div class="bubble ai"><p>You are signed in as Narihito. The sign-in is valid for another 59 days.</p></div>
    </div>
  </section>

  <section class="block" aria-labelledby="how-title">
    <h2 id="how-title">Connect in under a minute</h2>
    <p class="block-intro">There is nothing to install and no API keys to create.</p>
    <ol class="flow">
      <li><h3>Add the server</h3><p>Paste the server URL into your MCP client using the setup below.</p></li>
      <li><h3>Sign in with LinkedIn</h3><p>A LinkedIn sign-in page opens. Log in and select Allow.</p></li>
      <li><h3>Ask in plain words</h3><p>Your assistant can now act on your LinkedIn account whenever you ask.</p></li>
    </ol>
  </section>

  <section class="block" id="setup" aria-labelledby="setup-title">
    <h2 id="setup-title">Set up your client</h2>
    <p class="block-intro">Pick your client and follow the steps.</p>
    <div class="setup">
      <div role="tablist" aria-label="MCP clients">${renderTabs(list)}</div>
      ${renderPanels(list)}
    </div>
  </section>

  <section class="block" id="tools" aria-labelledby="tools-title">
    <h2 id="tools-title">Tools</h2>
    <p class="block-intro">What your assistant can do once you are connected.</p>
    ${renderTools(browserEnabled)}
  </section>
</main>

<footer class="footer">
  <span>Developed by <a class="author" href="${AUTHOR_URL}" rel="noopener">Narihito</a>. Not affiliated with LinkedIn.</span>
  <a href="${REPOSITORY_URL}" rel="noopener">Source on GitHub</a>
</footer>
</div>`,
  });
}

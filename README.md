<p align="center">
  <img src="public/linkedin-logo.svg" width="96" height="96" alt="LinkedIn logo">
</p>

<h1 align="center">LinkedIn MCP</h1>

A remote MCP server that lets Claude (and other MCP clients) manage a LinkedIn account: edit the profile, publish posts, network, message, and search and apply for jobs.

It supports many users. Each user connects their own LinkedIn account through OAuth. Their data is stored encrypted on the server, in one file per user.

## How it works

LinkedIn's official API only lets regular apps sign users in and publish or delete their own posts. Everything else needs partner access. So this server uses two paths:

| Path | Used for |
|---|---|
| Official API (OAuth + Posts API) | Sign-in, `create_post`, `delete_post` |
| Headless browser (Playwright) logged in as the user | Profile edits, reading posts, comments, reactions, networking, messaging, jobs, companies |

The browser always runs headless on the server, so no window ever opens. To connect it, the user opens a one-time link. The page streams the server's hidden browser to them, and they log in to LinkedIn there (2FA works). The resulting session cookies are encrypted and stored on the server.

LinkedIn is a trademark of LinkedIn Corporation. This project is not affiliated with or endorsed by LinkedIn.

> Browser automation goes against LinkedIn's User Agreement and can get an account restricted. Test with a secondary account first.

### Connection flow

1. The user adds `https://your-server/mcp` in their MCP client.
2. The client registers and redirects the user to **Sign in with LinkedIn**.
3. After sign-in, the user sees the remote login page and logs in to LinkedIn once. They can also click **Skip** and connect later.
4. Claude can now use every tool. If the browser session expires, tools reply with a fresh connect link.

## Storage

There is no database. OAuth clients, authorization codes and access/refresh tokens are sealed (AES-256-GCM) into the tokens themselves. Per-user state lives in `DATA_DIR/users/<id>.json`, encrypted with `SESSION_ENCRYPTION_KEY`. That state is the LinkedIn access token, the browser session, the optional proxy and the connect-link nonce.

Changing `SESSION_ENCRYPTION_KEY` makes every stored file and every issued token unreadable, so all users have to sign in again.

## Setup

### 1. Create a LinkedIn app

1. Open https://www.linkedin.com/developers/apps and click **Create app**. The app has to be linked to a LinkedIn Page. You can create a free page at https://www.linkedin.com/company/setup/new.
2. **Settings** tab: click **Verify** and approve the verification link as page admin.
3. **Products** tab: add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
4. **Auth** tab: copy the Client ID and Primary Client Secret. Add `<BASE_URL>/auth/linkedin/callback` to **Authorized redirect URLs**.

### 2. Configure

Copy `.env.example` to `.env` and fill it in:

| Variable | Description |
|---|---|
| `BASE_URL` | Public URL of the server, for example `http://localhost:3000` or `https://linkedin-mcp.example.com` |
| `PORT` | Port to listen on (default `3000`) |
| `LINKEDIN_CLIENT_ID` | From the LinkedIn app's Auth tab |
| `LINKEDIN_CLIENT_SECRET` | From the LinkedIn app's Auth tab |
| `LINKEDIN_API_VERSION` | LinkedIn REST API version as `YYYYMM` (default `202609`). Versions expire after about a year. |
| `SESSION_ENCRYPTION_KEY` | 32 random bytes as hex. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATA_DIR` | Folder for encrypted user files and debug screenshots (default `data`) |
| `MAX_BROWSERS` | Maximum number of browser contexts running at once (default `3`) |

### 3. Install and run

Requires Node.js 24 or newer.

```bash
npm install
npm run browser:install
npm run dev
```

For production:

```bash
npm run build
npm start
```

### 4. Connect a client

Claude Code:

```bash
claude mcp add --transport http linkedin http://localhost:3000/mcp
```

Claude Desktop or claude.ai: go to **Settings > Connectors > Add custom connector** and enter `<BASE_URL>/mcp`.

## Tools

| Area | Tools |
|---|---|
| Account | `whoami`, `session_status`, `connect_session_link`, `disconnect_session`, `set_browser_proxy` |
| Profile | `get_my_profile`, `update_headline`, `update_about`, `update_location`, `update_contact_info`, `add_experience`, `update_experience`, `delete_experience`, `add_education`, `update_education`, `delete_education`, `add_skills`, `remove_skill`, `update_profile_photo`, `update_banner`, `set_open_to_work` |
| Posts | `create_post`, `delete_post`, `list_my_posts`, `get_post_stats`, `comment_on_post`, `react_to_post` |
| Network | `search_people`, `get_profile`, `send_connection_request`, `list_invitations`, `accept_invitation`, `ignore_invitation`, `withdraw_invitation`, `list_connections`, `remove_connection`, `follow`, `unfollow` |
| Messaging | `list_conversations`, `read_conversation`, `send_message` |
| Jobs | `search_jobs`, `get_job`, `save_job`, `list_saved_jobs`, `easy_apply`, `get_company`, `search_companies` |

## Deployment

The server needs to be a long-running Node process with:

- a persistent disk for `DATA_DIR`
- WebSocket support (used by the remote login page)
- room to run Chromium

**Serverless platforms such as Vercel will not work.** They have no WebSockets, no persistent disk, and size and time limits that rule out Chromium.

Use a VPS, Railway, Render, Fly.io or similar, with a persistent volume mounted at `DATA_DIR`. Put it behind HTTPS and set `BASE_URL` to the public HTTPS URL.

LinkedIn often challenges logins from datacenter IP addresses. If that happens, set a residential proxy for each user with `set_browser_proxy`.

## Limitations

- The browser tools rely on LinkedIn's web UI. They expect the account's display language to be **English**, and they may need selector updates when LinkedIn changes its layout. Selectors live in each module's `*.selectors.ts`.
- On the remote login page, use email and password. "Sign in with Google/Microsoft/Apple" opens popups, which are not streamed.
- When a browser tool fails unexpectedly, a screenshot is saved to `DATA_DIR/debug/` for troubleshooting.

## Development

```bash
npm run typecheck
npm test
```

## Project structure

```
src/
  index.ts                Express app: OAuth routes, /mcp, session pages, WebSocket
  mcp/server.ts           Creates the MCP server and registers all tool modules
  modules/
    auth/                 OAuth provider (sealed tokens), LinkedIn OIDC, whoami
    session/              Remote login page (connect.page.ts), screencast WebSocket, browser session tools
    profile/              Profile read and edit tools
    posts/                Posts API client and post tools
    network/              Search, connections, invitations, follow
    messaging/            Conversations and messages
    jobs/                 Jobs and companies
  shared/
    lib/                  env, seal, userStore, browserPool, pageActions, pageExtract, logger
    utils/                defineTool, toolResult, errors, cookies, html, linkedinIds, littleText, safeFetch
public/                   Static assets (logo)
```

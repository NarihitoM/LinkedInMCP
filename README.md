<p align="center">
  <img src="public/linkedin-logo.svg" width="96" height="96" alt="LinkedIn logo">
</p>

<h1 align="center">LinkedIn MCP</h1>

A remote MCP server that connects your LinkedIn account to Claude and any other MCP client. Sign in with LinkedIn, then publish posts and check your account. Run it yourself to also edit your profile, network, message people and apply for jobs.

LinkedIn is a trademark of LinkedIn Corporation. This project is not affiliated with or endorsed by LinkedIn.

## Setup

Connect a client to `https://linked-in-mcp-by-narihito.vercel.app/mcp`. The home page at https://linked-in-mcp-by-narihito.vercel.app has step-by-step setup for every client.

Claude Code:

```bash
claude mcp add --transport http linkedin https://linked-in-mcp-by-narihito.vercel.app/mcp
```

Then run `/mcp`, choose **linkedin**, select **Authenticate**, and sign in with LinkedIn.

Claude Desktop or claude.ai: go to **Settings > Connectors > Add custom connector**, name it **LinkedIn** and paste the URL above.

## Two modes

LinkedIn's official API only lets regular apps sign users in and publish or delete their own posts. Everything else needs partner access, so the remaining tools drive a headless browser logged in as you. The same code runs in two modes:

| Mode | Where | Tools |
|---|---|---|
| API | Vercel (the hosted URL above) | `whoami`, `create_post`, `delete_post` |
| Full | Your own machine or any always-on server | All 48 tools |

The mode is chosen automatically: on Vercel the browser tools are turned off, because Vercel functions can't run Chrome, hold WebSocket connections or keep files. Everywhere else they are on.

> Browser automation goes against LinkedIn's User Agreement and can get an account restricted. Test with a secondary account first.

### Full mode connection flow

1. Add `http://localhost:3000/mcp` (or your server's URL) in your MCP client.
2. Sign in with LinkedIn when the client asks.
3. The remote login page opens. It streams the server's hidden browser to you, and you log in to LinkedIn there (2FA works). Nothing opens on the server's screen. You can also click **Skip** and connect later.
4. The server checks that the browser login is the same LinkedIn account you signed in with, then saves the session encrypted. If it expires, tools reply with a fresh connect link.

## Tools

| Area | Tools |
|---|---|
| Account | `whoami`, `session_status`, `connect_session_link`, `disconnect_session`, `set_browser_proxy` |
| Profile | `get_my_profile`, `update_headline`, `update_about`, `update_location`, `update_contact_info`, `add_experience`, `update_experience`, `delete_experience`, `add_education`, `update_education`, `delete_education`, `add_skills`, `remove_skill`, `update_profile_photo`, `update_banner`, `set_open_to_work` |
| Posts | `create_post`, `delete_post`, `list_my_posts`, `get_post_stats`, `comment_on_post`, `react_to_post` |
| Network | `search_people`, `get_profile`, `send_connection_request`, `list_invitations`, `accept_invitation`, `ignore_invitation`, `withdraw_invitation`, `list_connections`, `remove_connection`, `follow`, `unfollow` |
| Messaging | `list_conversations`, `read_conversation`, `send_message` |
| Jobs | `search_jobs`, `get_job`, `save_job`, `list_saved_jobs`, `easy_apply`, `get_company`, `search_companies` |

In API mode only `whoami`, `create_post` and `delete_post` are listed.

## Storage

There is no database. OAuth clients, authorization codes and access/refresh tokens are sealed with AES-256-GCM. Each token carries the signed-in member and their LinkedIn access token, so API mode stores nothing at all.

In full mode, each user's browser session, optional proxy and connect-link nonce live in `DATA_DIR/users/<id>.json`, encrypted with `SESSION_ENCRYPTION_KEY`.

Changing `SESSION_ENCRYPTION_KEY` makes every stored file and issued token unreadable, so everyone has to sign in again.

## Security

- Connect links are single-use, expire after 15 minutes, and are sealed to one user.
- After the remote login, the server runs LinkedIn's OAuth flow inside that browser and checks that the LinkedIn member matches the account that signed in. A session for any other account is rejected, so a connect link can't be used to capture someone else's account.
- Server-side browsers (including their WebSockets), image downloads and user proxies can't reach private, loopback or link-local addresses. Service workers are blocked. Image downloads are pinned to the checked address, capped at 10 MB and limited to 45 seconds. Proxies must be `http://` or `socks5://` and are pinned to their checked IP.
- Pages send a strict nonce-based Content Security Policy. The login WebSocket only accepts connections from `BASE_URL`'s origin.

## Run it yourself

### 1. Create a LinkedIn app

1. Open https://www.linkedin.com/developers/apps and click **Create app**. The app has to be linked to a LinkedIn Page. You can create a free page at https://www.linkedin.com/company/setup/new.
2. **Settings** tab: click **Verify** and approve the verification link as page admin.
3. **Products** tab: add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
4. **Auth** tab: copy the Client ID and Primary Client Secret. Under **Authorized redirect URLs**, add one entry per place you run the server:
   - `http://localhost:3000/auth/linkedin/callback`
   - `https://linked-in-mcp-by-narihito.vercel.app/auth/linkedin/callback`

### 2. Configure

Copy `.env.example` to `.env` and fill it in:

| Variable | Description |
|---|---|
| `BASE_URL` | Public URL of the server, for example `http://localhost:3000`. On Vercel it defaults to the production URL. |
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

Open http://localhost:3000 for the setup page, or connect a client to `http://localhost:3000/mcp`.

For production:

```bash
npm run build
npm start
```

### Deploying to Vercel

1. Import the repository in Vercel. `vercel.json` sets the build command.
2. In **Settings > Environment Variables**, add `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `SESSION_ENCRYPTION_KEY`. You can use **Import .env** and paste your `.env` contents, but leave out `BASE_URL`, `PORT` and `DATA_DIR`.
3. Add `https://<your-project>.vercel.app/auth/linkedin/callback` to the LinkedIn app's redirect URLs.
4. Redeploy.

Vercel runs API mode. For full mode on a server, use a VPS, Railway, Render or Fly.io with a persistent volume at `DATA_DIR`, behind HTTPS. LinkedIn often challenges logins from datacenter IP addresses. If that happens, set a residential proxy per user with `set_browser_proxy`.

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
  app.ts                  Express app (Vercel entry): OAuth, home page, /mcp, session pages
  server.ts               Local entry: listens, attaches the login WebSocket, shuts down browsers
  mcp/server.ts           Creates the MCP server and registers tools for the current mode
  modules/
    home/                 Setup home page
    auth/                 OAuth provider (sealed tokens), whoami
    session/              Remote login page, screencast WebSocket, browser session tools
    profile/              Profile read and edit tools
    posts/                Posts API client and post tools
    network/              Search, connections, invitations, follow
    messaging/            Conversations and messages
    jobs/                 Jobs and companies
  shared/
    lib/                  env, seal, linkedinOidc, userStore, browserPool, pageActions, pageExtract, logger
    utils/                defineTool, toolResult, errors, cookies, html, netGuard, linkedinIds, littleText, safeFetch
public/                   Static assets (logo)
```

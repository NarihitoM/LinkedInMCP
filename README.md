<p align="center">
  <img src="public/linkedin-logo.svg" width="96" height="96" alt="LinkedIn logo">
</p>

<h1 align="center">LinkedIn MCP</h1>

A remote MCP server that connects your LinkedIn account to Claude and any other MCP client. Sign in with LinkedIn, then publish and delete posts and check your account through LinkedIn's official API.

LinkedIn is a trademark of LinkedIn Corporation. This project is not affiliated with or endorsed by LinkedIn.

## Setup

Connect a client to `https://linked-in-mcp-by-narihito.vercel.app/mcp`. The home page at https://linked-in-mcp-by-narihito.vercel.app has step-by-step setup for every client.

Claude Code:

```bash
claude mcp add --transport http linkedin https://linked-in-mcp-by-narihito.vercel.app/mcp
```

Then run `/mcp`, choose **linkedin**, select **Authenticate**, and sign in with LinkedIn.

Claude Desktop or claude.ai: go to **Settings > Connectors > Add custom connector**, name it **LinkedIn** and paste the URL above.

## Tools

| Tool | What it does |
|---|---|
| `whoami` | Shows the signed-in member, granted scopes and when the sign-in expires |
| `create_post` | Publishes a text post, optionally with one image or a link preview |
| `delete_post` | Deletes one of your own posts |

LinkedIn's API only lets regular apps sign users in and publish or delete their own posts, so that is all this server does. Profile edits, networking, messaging and jobs need LinkedIn partner access.

## Storage

There is no database and nothing is written to disk. OAuth clients, authorization codes and access/refresh tokens are sealed with AES-256-GCM using `SESSION_ENCRYPTION_KEY`. Each token carries the signed-in member and their LinkedIn access token.

Changing `SESSION_ENCRYPTION_KEY` makes every issued token unreadable, so everyone has to sign in again.

## Security

- Tokens are sealed with AES-256-GCM, bound to their type and checked for expiry. Once the LinkedIn sign-in expires, the MCP tokens stop working too.
- Image downloads for `create_post` can't reach private, loopback or link-local addresses. They are pinned to the checked address, capped at 10 MB and limited to 45 seconds.
- Pages send a strict nonce-based Content Security Policy.

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

### 3. Install and run

Requires Node.js 24 or newer.

```bash
npm install
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
2. In **Settings > Environment Variables**, add `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `SESSION_ENCRYPTION_KEY`. You can use **Import .env** and paste your `.env` contents. A localhost `BASE_URL` is ignored on Vercel.
3. Add `https://<your-project>.vercel.app/auth/linkedin/callback` to the LinkedIn app's redirect URLs.
4. Redeploy.

## Development

```bash
npm run typecheck
npm test
```

## Project structure

```
src/
  app.ts                  Express app (Vercel entry): OAuth, home page, /mcp
  server.ts               Local entry
  mcp/server.ts           Creates the MCP server and registers the tools
  modules/
    home/                 Setup home page
    auth/                 OAuth provider (sealed tokens), whoami
    posts/                Posts API client, create_post and delete_post
  shared/
    lib/                  env, seal, linkedinOidc, logger
    utils/                defineTool, toolResult, errors, cookies, html, netGuard, littleText, safeFetch
public/                   Static assets (logo)
```

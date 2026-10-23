import type { BrowserContext, Page } from "playwright";
import { z } from "zod";
import { withContext, type ProxySettings, type StorageState } from "../../shared/lib/browserPool.ts";
import { getEnv } from "../../shared/lib/env.ts";
import { logger } from "../../shared/lib/logger.ts";
import { captureScreenshot } from "../../shared/lib/pageActions.ts";
import { randomToken, seal, unseal } from "../../shared/lib/seal.ts";
import { runExclusive } from "../../shared/lib/userQueue.ts";
import { readUser, updateUser, type UserRecord } from "../../shared/lib/userStore.ts";
import { LoginWallError, ToolError } from "../../shared/utils/errors.ts";
import { resolvePublicAddress } from "../../shared/utils/netGuard.ts";

export const CONNECT_TTL = 15 * 60;

const connectSchema = z.object({
  userId: z.string(),
  nonce: z.string(),
  next: z.string().optional(),
});

export type ConnectGrant = z.infer<typeof connectSchema>;

export interface LinkedInSession {
  page: Page;
  context: BrowserContext;
  me: string;
}

export async function createConnectUrl(userId: string, next?: string): Promise<string> {
  const nonce = randomToken();
  await updateUser(userId, (user) => ({ ...user, connectNonce: nonce }));
  const token = seal("connect", { userId, nonce, next }, CONNECT_TTL);
  return `${getEnv().BASE_URL}/session/connect?t=${encodeURIComponent(token)}`;
}

export async function consumeConnectToken(token: string): Promise<ConnectGrant | undefined> {
  const opened = unseal("connect", token, connectSchema);
  if (!opened) return undefined;

  const grant = opened.data;
  let valid = false;
  await updateUser(grant.userId, (user) => {
    valid = user.connectNonce === grant.nonce;
    return valid ? { ...user, connectNonce: undefined } : user;
  }).catch(() => undefined);

  return valid ? grant : undefined;
}

export function peekConnectToken(token: string): ConnectGrant | undefined {
  return unseal("connect", token, connectSchema)?.data;
}

export function parseProxy(raw: string): ProxySettings {
  const url = new URL(raw);
  if (!["http:", "https:", "socks5:"].includes(url.protocol)) {
    throw new ToolError("Proxy URL must start with http://, https:// or socks5://");
  }
  return {
    server: `${url.protocol}//${url.host}`,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

export async function checkedProxy(raw: string): Promise<ProxySettings> {
  const proxy = parseProxy(raw);
  const server = new URL(proxy.server);
  let address: string;
  try {
    address = await resolvePublicAddress(server.hostname);
  } catch {
    throw new ToolError("The proxy host must resolve to a public internet address.");
  }
  if (server.protocol === "https:") return proxy;

  const host = address.includes(":") ? `[${address}]` : address;
  return { ...proxy, server: `${server.protocol}//${host}${server.port ? `:${server.port}` : ""}` };
}

export async function proxyFor(user: UserRecord | undefined): Promise<ProxySettings | undefined> {
  return user?.proxyUrl ? checkedProxy(user.proxyUrl) : undefined;
}

export function hasAuthCookie(state: StorageState, now = Date.now()): boolean {
  return state.cookies.some(
    (cookie) => cookie.name === "li_at" && cookie.domain.endsWith("linkedin.com") && (cookie.expires === -1 || cookie.expires * 1000 > now),
  );
}

export async function saveBrowserSession(userId: string, storageState: StorageState, publicIdentifier: string): Promise<void> {
  await updateUser(userId, (user) => ({
    ...user,
    browser: { storageState, publicIdentifier, status: "active", updatedAt: Date.now() },
  }));
}

async function markExpired(userId: string): Promise<void> {
  await updateUser(userId, (user) =>
    user.browser ? { ...user, browser: { ...user.browser, status: "expired", updatedAt: Date.now() } } : user,
  );
}

async function sessionRequired(userId: string, reason: string): Promise<ToolError> {
  const url = await createConnectUrl(userId);
  return new ToolError(
    `${reason} Ask the user to open this link, log in to LinkedIn there, then retry: ${url} (the link works once and expires in 15 minutes)`,
  );
}

export async function withLinkedIn<T>(userId: string, task: (session: LinkedInSession) => Promise<T>): Promise<T> {
  return runExclusive(`browser:${userId}`, async () => {
    const user = await readUser(userId);
    const browser = user?.browser;

    if (!browser || browser.status !== "active") {
      throw await sessionRequired(userId, "The LinkedIn browser session is not connected.");
    }
    if (!hasAuthCookie(browser.storageState)) {
      await markExpired(userId);
      throw await sessionRequired(userId, "The LinkedIn browser session expired.");
    }

    const proxy = await proxyFor(user);
    try {
      return await withContext({ storageState: browser.storageState, proxy }, async (context) => {
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        try {
          const result = await task({ page, context, me: browser.publicIdentifier });
          await saveBrowserSession(userId, await context.storageState(), browser.publicIdentifier);
          return result;
        } catch (error) {
          if (!(error instanceof LoginWallError) && !(error instanceof ToolError)) {
            const screenshot = await captureScreenshot(page, "tool-failure");
            logger.warn("Browser task failed", { userId, url: page.url(), screenshot, error });
          }
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof LoginWallError) {
        await markExpired(userId);
        throw await sessionRequired(userId, "LinkedIn signed this session out or asked for a security check.");
      }
      throw error;
    }
  });
}

export async function getSessionStatus(userId: string) {
  const user = await readUser(userId);
  const browser = user?.browser;
  return {
    status: browser?.status ?? "not connected",
    profileUrl: browser ? `https://www.linkedin.com/in/${browser.publicIdentifier}/` : null,
    updatedAt: browser ? new Date(browser.updatedAt).toISOString() : null,
    authCookieValid: browser ? hasAuthCookie(browser.storageState) : false,
    proxy: user?.proxyUrl ? parseProxy(user.proxyUrl).server : null,
  };
}

export async function disconnectBrowserSession(userId: string): Promise<void> {
  await updateUser(userId, (user) => ({ ...user, browser: undefined, connectNonce: undefined }));
}

export async function setProxy(userId: string, proxyUrl: string | undefined): Promise<void> {
  if (proxyUrl) await checkedProxy(proxyUrl);
  await updateUser(userId, (user) => ({ ...user, proxyUrl }));
}

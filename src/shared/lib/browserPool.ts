import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Route } from "playwright";
import { assertPublicHostname } from "../utils/netGuard.ts";
import { getEnv } from "./env.ts";
import { logger } from "./logger.ts";

export const VIEWPORT = { width: 1280, height: 800 } as const;

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface ProxySettings {
  server: string;
  username?: string;
  password?: string;
}

export interface ContextOptions {
  storageState?: StorageState;
  proxy?: ProxySettings;
}

const PLATFORM_TOKENS: Record<string, string> = {
  win32: "Windows NT 10.0; Win64; x64",
  darwin: "Macintosh; Intel Mac OS X 10_15_7",
  linux: "X11; Linux x86_64",
};

let browserPromise: Promise<Browser> | undefined;
let activeContexts = 0;
const waiting: Array<() => void> = [];

function launchBrowser(): Promise<Browser> {
  const launching = chromium
    .launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    })
    .then((browser) => {
      browser.on("disconnected", () => {
        browserPromise = undefined;
      });
      return browser;
    });

  launching.catch(() => {
    browserPromise = undefined;
  });

  return launching;
}

function getBrowser(): Promise<Browser> {
  browserPromise ??= launchBrowser();
  return browserPromise;
}

function userAgentFor(browser: Browser): string {
  const major = browser.version().split(".")[0] ?? "140";
  const platform = PLATFORM_TOKENS[process.platform] ?? "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

async function blockPrivateNetworks(context: BrowserContext): Promise<void> {
  const verdicts = new Map<string, Promise<boolean>>();

  await context.route("**/*", async (route: Route) => {
    const { hostname } = new URL(route.request().url());
    let verdict = verdicts.get(hostname);
    if (!verdict) {
      verdict = assertPublicHostname(hostname).then(
        () => true,
        () => false,
      );
      verdicts.set(hostname, verdict);
    }

    if (await verdict) {
      await route.continue().catch(() => undefined);
    } else {
      logger.warn("Blocked browser request to a private network address", { hostname });
      await route.abort("blockedbyclient").catch(() => undefined);
    }
  });
}

async function acquireSlot(): Promise<void> {
  if (activeContexts < getEnv().MAX_BROWSERS) {
    activeContexts += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) {
    next();
  } else {
    activeContexts -= 1;
  }
}

export async function withContext<T>(options: ContextOptions, task: (context: BrowserContext) => Promise<T>): Promise<T> {
  await acquireSlot();
  let context: BrowserContext | undefined;

  try {
    const browser = await getBrowser();
    const contextOptions: BrowserContextOptions = {
      viewport: VIEWPORT,
      userAgent: userAgentFor(browser),
      locale: "en-US",
      ...(options.storageState ? { storageState: options.storageState } : {}),
      ...(options.proxy ? { proxy: options.proxy } : {}),
    };
    context = await browser.newContext(contextOptions);
    await blockPrivateNetworks(context);
    return await task(context);
  } finally {
    if (context) {
      await context.close().catch((error: unknown) => logger.warn("Failed to close browser context", { error }));
    }
    releaseSlot();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => undefined);
  browserPromise = undefined;
  await browser?.close();
}

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { BrowserContext, Page } from "playwright";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { z } from "zod";
import { VIEWPORT, withContext } from "../../shared/lib/browserPool.ts";
import { getEnv } from "../../shared/lib/env.ts";
import { logger } from "../../shared/lib/logger.ts";
import { isLoginWall, LINKEDIN_URL } from "../../shared/lib/pageActions.ts";
import { readUser } from "../../shared/lib/userStore.ts";
import { consumeConnectToken, hasAuthCookie, proxyFor, saveBrowserSession, type ConnectGrant } from "./session.service.ts";

export const SOCKET_PATH = "/session/ws";

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const HELLO_TIMEOUT_MS = 10_000;
const POLL_MS = 1_500;

const NAMED_KEYS = [
  "Enter",
  "Backspace",
  "Tab",
  "Escape",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
] as const;

const coordinate = z.number().finite().min(0).max(4000);

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), token: z.string().max(4096) }),
  z.object({
    type: z.literal("mouse"),
    action: z.enum(["move", "down", "up"]),
    x: coordinate,
    y: coordinate,
    button: z.enum(["left", "right", "middle"]).default("left"),
  }),
  z.object({
    type: z.literal("wheel"),
    x: coordinate,
    y: coordinate,
    deltaX: z.number().finite().min(-5000).max(5000),
    deltaY: z.number().finite().min(-5000).max(5000),
  }),
  z.object({ type: z.literal("key"), key: z.enum(NAMED_KEYS) }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(2000) }),
]);

type ClientMessage = z.infer<typeof clientMessageSchema>;
type ServerMessage =
  | { type: "status"; message: string }
  | { type: "frame"; data: string; width: number; height: number }
  | { type: "done"; next: string | null }
  | { type: "error"; message: string };

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseMessage(raw: RawData): ClientMessage | undefined {
  try {
    const parsed = clientMessageSchema.safeParse(JSON.parse(raw.toString()));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function applyInput(page: Page, message: ClientMessage): Promise<void> {
  switch (message.type) {
    case "mouse":
      await page.mouse.move(message.x, message.y);
      if (message.action === "down") await page.mouse.down({ button: message.button });
      if (message.action === "up") await page.mouse.up({ button: message.button });
      return;
    case "wheel":
      await page.mouse.move(message.x, message.y);
      await page.mouse.wheel(message.deltaX, message.deltaY);
      return;
    case "key":
      await page.keyboard.press(message.key);
      return;
    case "text":
      await page.keyboard.insertText(message.text);
      return;
    case "hello":
      return;
  }
}

async function resolvePublicIdentifier(page: Page): Promise<string> {
  await page.goto(`${LINKEDIN_URL}/in/me/`, { waitUntil: "commit", timeout: 30_000 });
  await page.waitForURL(/linkedin\.com\/in\/(?!me\/)[^/?#]+/, { timeout: 30_000 }).catch(() => undefined);
  const match = page.url().match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!match?.[1] || match[1] === "me") {
    throw new Error("Could not determine the LinkedIn profile URL after login");
  }
  return decodeURIComponent(match[1]);
}

function waitForLogin(context: BrowserContext, page: Page, socket: WebSocket): Promise<"done" | "closed" | "timeout"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: "done" | "closed" | "timeout") => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve(outcome);
    };

    const poll = setInterval(() => {
      void context
        .storageState()
        .then((state) => {
          if (hasAuthCookie(state) && !isLoginWall(page.url()) && page.url().startsWith(LINKEDIN_URL)) {
            finish("done");
          }
        })
        .catch(() => undefined);
    }, POLL_MS);
    const timeout = setTimeout(() => finish("timeout"), LOGIN_TIMEOUT_MS);
    socket.once("close", () => finish("closed"));
  });
}

async function runLogin(socket: WebSocket, grant: ConnectGrant): Promise<void> {
  const user = await readUser(grant.userId);
  send(socket, { type: "status", message: "Starting a secure browser..." });

  await withContext({ proxy: proxyFor(user) }, async (context) => {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    cdp.on("Page.screencastFrame", (frame) => {
      send(socket, {
        type: "frame",
        data: frame.data,
        width: frame.metadata.deviceWidth ?? VIEWPORT.width,
        height: frame.metadata.deviceHeight ?? VIEWPORT.height,
      });
      void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    });

    let inputChain = Promise.resolve();
    socket.on("message", (raw) => {
      const message = parseMessage(raw);
      if (!message) return;
      inputChain = inputChain.then(() => applyInput(page, message)).catch(() => undefined);
    });

    await page.goto(`${LINKEDIN_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 70,
      maxWidth: VIEWPORT.width,
      maxHeight: VIEWPORT.height,
    });
    send(socket, { type: "status", message: "Log in to LinkedIn below. Your password goes straight to LinkedIn." });

    const outcome = await waitForLogin(context, page, socket);
    await cdp.send("Page.stopScreencast").catch(() => undefined);

    if (outcome === "timeout") {
      send(socket, { type: "error", message: "Login timed out. Ask Claude for a new connect link." });
      return;
    }
    if (outcome === "closed") return;

    send(socket, { type: "status", message: "Logged in. Saving your session..." });
    const publicIdentifier = await resolvePublicIdentifier(page);
    await saveBrowserSession(grant.userId, await context.storageState(), publicIdentifier);
    send(socket, { type: "done", next: grant.next ?? null });
  });
}

function handleConnection(socket: WebSocket): void {
  const helloTimer = setTimeout(() => socket.close(4000, "hello timeout"), HELLO_TIMEOUT_MS);

  socket.once("message", (raw) => {
    clearTimeout(helloTimer);
    const message = parseMessage(raw);
    if (message?.type !== "hello") {
      socket.close(4001, "expected hello");
      return;
    }

    void consumeConnectToken(message.token).then(async (grant) => {
      if (!grant) {
        send(socket, { type: "error", message: "This connect link is invalid, expired or already used. Ask Claude for a new one." });
        socket.close(4003, "invalid token");
        return;
      }
      try {
        await runLogin(socket, grant);
      } catch (error) {
        logger.error("Remote login failed", { error });
        send(socket, { type: "error", message: "Something went wrong while connecting. Ask Claude for a new connect link." });
      } finally {
        socket.close(1000, "finished");
      }
    });
  });
}

function rejectUpgrade(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachSessionSocket(server: Server): void {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const allowedOrigin = new URL(getEnv().BASE_URL).origin;

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", allowedOrigin);
    if (url.pathname !== SOCKET_PATH) {
      rejectUpgrade(socket, "404 Not Found");
      return;
    }
    if (request.headers.origin !== allowedOrigin) {
      rejectUpgrade(socket, "403 Forbidden");
      return;
    }
    sockets.handleUpgrade(request, socket, head, handleConnection);
  });
}

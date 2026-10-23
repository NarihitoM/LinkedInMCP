import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StorageState } from "../../shared/lib/browserPool.ts";
import { saveUser, userIdFor } from "../../shared/lib/userStore.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { consumeConnectToken, createConnectUrl, hasAuthCookie, parseProxy, withLinkedIn } from "./session.service.ts";

const DATA_DIR = join("data-test", "session-service");
process.env.DATA_DIR = DATA_DIR;

const userId = userIdFor("member-session");

function stateWith(expires: number): StorageState {
  return {
    cookies: [
      { name: "li_at", value: "x", domain: ".www.linkedin.com", path: "/", expires, httpOnly: true, secure: true, sameSite: "None" },
    ],
    origins: [],
  };
}

beforeAll(async () => {
  await saveUser({
    id: userId,
    sub: "member-session",
    name: "Session Test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
});

afterAll(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
});

describe("session service", () => {
  it("detects a valid li_at cookie", () => {
    expect(hasAuthCookie(stateWith(Date.now() / 1000 + 3600))).toBe(true);
    expect(hasAuthCookie(stateWith(-1))).toBe(true);
    expect(hasAuthCookie(stateWith(Date.now() / 1000 - 10))).toBe(false);
    expect(hasAuthCookie({ cookies: [], origins: [] })).toBe(false);
  });

  it("parses proxy URLs with credentials", () => {
    expect(parseProxy("http://user:p%40ss@proxy.example:8080")).toEqual({
      server: "http://proxy.example:8080",
      username: "user",
      password: "p@ss",
    });
    expect(() => parseProxy("ftp://proxy.example")).toThrow(ToolError);
  });

  it("creates single-use connect links", async () => {
    const url = new URL(await createConnectUrl(userId, "http://localhost:5555/callback?code=1"));
    expect(url.pathname).toBe("/session/connect");
    const token = url.searchParams.get("t") ?? "";

    const grant = await consumeConnectToken(token);
    expect(grant?.userId).toBe(userId);
    expect(grant?.next).toBe("http://localhost:5555/callback?code=1");
    expect(await consumeConnectToken(token)).toBeUndefined();
  });

  it("invalidates older links when a new one is created", async () => {
    const first = new URL(await createConnectUrl(userId)).searchParams.get("t") ?? "";
    const second = new URL(await createConnectUrl(userId)).searchParams.get("t") ?? "";
    expect(await consumeConnectToken(first)).toBeUndefined();
    expect((await consumeConnectToken(second))?.userId).toBe(userId);
  });

  it("asks for a connect link when no browser session exists", async () => {
    await expect(withLinkedIn(userId, async () => "never")).rejects.toThrow(/session\/connect\?t=/);
  });
});

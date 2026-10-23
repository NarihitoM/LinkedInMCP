import type { Response } from "express";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { describe, expect, it } from "vitest";
import { seal } from "../../shared/lib/seal.ts";
import { LinkedInOAuthProvider } from "./auth.provider.ts";
import { userIdFor } from "./auth.service.ts";
import { AUTHORIZATION_CODE_TTL, type AuthorizationCode } from "./auth.types.ts";

const provider = new LinkedInOAuthProvider();
const userId = userIdFor("member-auth");

async function registerClient(): Promise<OAuthClientInformationFull> {
  const registered = await provider.clientsStore.registerClient?.({
    redirect_uris: ["http://localhost:5555/callback"],
    client_name: "Test client",
    token_endpoint_auth_method: "none",
  });
  if (!registered) throw new Error("registration failed");
  return registered;
}

function issueCode(client: OAuthClientInformationFull, overrides: Partial<AuthorizationCode> = {}): string {
  const code: AuthorizationCode = {
    clientId: client.client_id,
    userId,
    scopes: ["linkedin"],
    member: { sub: "member-auth", name: "Auth Test", email: "auth@example.com" },
    linkedin: { accessToken: "linkedin-token", scopes: ["openid", "w_member_social"], expiresAt: Date.now() + 60_000 },
    codeChallenge: "challenge",
    redirectUri: "http://localhost:5555/callback",
    ...overrides,
  };
  return seal("code", code, AUTHORIZATION_CODE_TTL);
}

describe("LinkedInOAuthProvider", () => {
  it("registers public clients with a sealed client id", async () => {
    const client = await registerClient();
    expect(client.client_secret).toBeUndefined();
    expect(client.token_endpoint_auth_method).toBe("none");

    const loaded = await provider.clientsStore.getClient(client.client_id);
    expect(loaded?.redirect_uris).toEqual(["http://localhost:5555/callback"]);
    expect(await provider.clientsStore.getClient("forged")).toBeUndefined();
  });

  it("forces public clients even when a secret method is requested", async () => {
    const client = await provider.clientsStore.registerClient?.({
      redirect_uris: ["http://localhost:5555/callback"],
      token_endpoint_auth_method: "client_secret_post",
      client_secret: "should-be-dropped",
    });
    expect(client?.token_endpoint_auth_method).toBe("none");
    expect(client?.client_secret).toBeUndefined();
  });

  it("redirects authorize requests to LinkedIn with a sealed cookie", async () => {
    const client = await registerClient();
    const headers: Record<string, string> = {};
    let location = "";
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      redirect: (url: string) => {
        location = url;
      },
    } as unknown as Response;

    await provider.authorize(client, { codeChallenge: "abc", redirectUri: "http://localhost:5555/callback", state: "xyz" }, res);

    const url = new URL(location);
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.searchParams.get("scope")).toBe("openid profile email w_member_social");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/linkedin/callback");
    expect(headers["Set-Cookie"]).toMatch(/^li_authorize=.+HttpOnly; SameSite=Lax$/);
  });

  it("exchanges a code for tokens that carry the member and LinkedIn token", async () => {
    const client = await registerClient();
    const code = issueCode(client);

    expect(await provider.challengeForAuthorizationCode(client, code)).toBe("challenge");
    const tokens = await provider.exchangeAuthorizationCode(client, code, undefined, "http://localhost:5555/callback");
    expect(tokens.token_type).toBe("Bearer");

    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.extra?.userId).toBe(userId);
    expect(info.extra?.grant).toMatchObject({
      member: { sub: "member-auth", name: "Auth Test" },
      linkedin: { accessToken: "linkedin-token" },
    });
    expect(info.extra?.grant).not.toHaveProperty("codeChallenge");
    expect(info.scopes).toEqual(["linkedin"]);
  });

  it("rejects codes issued to another client or redirect uri", async () => {
    const client = await registerClient();
    const other = await registerClient();
    const code = issueCode(client);

    await expect(provider.exchangeAuthorizationCode(other, code)).rejects.toThrow();
    await expect(provider.exchangeAuthorizationCode(client, code, undefined, "http://evil.example/cb")).rejects.toThrow();
  });

  it("refreshes tokens and refuses access tokens used as refresh tokens", async () => {
    const client = await registerClient();
    const tokens = await provider.exchangeAuthorizationCode(client, issueCode(client));
    if (!tokens.refresh_token) throw new Error("missing refresh token");

    const refreshed = await provider.exchangeRefreshToken(client, tokens.refresh_token);
    expect((await provider.verifyAccessToken(refreshed.access_token)).extra?.userId).toBe(userId);
    await expect(provider.exchangeRefreshToken(client, tokens.access_token)).rejects.toThrow();
  });

  it("rejects tokens once the LinkedIn sign-in has expired", async () => {
    const client = await registerClient();
    const expired = { accessToken: "old", scopes: ["openid"], expiresAt: Date.now() - 1 };
    const tokens = await provider.exchangeAuthorizationCode(client, issueCode(client, { linkedin: expired }));
    if (!tokens.refresh_token) throw new Error("missing refresh token");

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow("expired");
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token)).rejects.toThrow("expired");
  });
});

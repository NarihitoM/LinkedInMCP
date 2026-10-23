import { z } from "zod";
import { getEnv } from "../../shared/lib/env.ts";

const AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"];
export const CALLBACK_PATH = "/auth/linkedin/callback";

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  scope: z.string().optional(),
});

const userInfoSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().optional(),
  picture: z.string().optional(),
});

export type LinkedInUserInfo = z.infer<typeof userInfoSchema>;

export interface LinkedInAccessToken {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export function callbackUrl(): string {
  return `${getEnv().BASE_URL}${CALLBACK_PATH}`;
}

export function buildAuthorizationUrl(state: string): string {
  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", getEnv().LINKEDIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return url.toString();
}

export async function exchangeCode(code: string): Promise<LinkedInAccessToken> {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET } = getEnv();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(),
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const token = tokenSchema.parse(await response.json());
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scopes: (token.scope ?? LINKEDIN_SCOPES.join(",")).split(/[\s,]+/).filter(Boolean),
  };
}

export async function fetchUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn userinfo failed with HTTP ${response.status}`);
  }

  return userInfoSchema.parse(await response.json());
}

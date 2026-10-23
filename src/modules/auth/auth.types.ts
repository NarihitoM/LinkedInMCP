import { z } from "zod";

export const ACCESS_TOKEN_TTL = 24 * 60 * 60;
export const REFRESH_TOKEN_TTL = 90 * 24 * 60 * 60;
export const AUTHORIZATION_CODE_TTL = 5 * 60;
export const AUTHORIZE_TTL = 10 * 60;
export const MCP_SCOPE = "linkedin";

export const pendingAuthorizationSchema = z.object({
  nonce: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
  codeChallenge: z.string(),
  state: z.string().optional(),
  scopes: z.array(z.string()),
  resource: z.string().optional(),
});

export const authorizationCodeSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  codeChallenge: z.string(),
  redirectUri: z.string(),
  scopes: z.array(z.string()),
  resource: z.string().optional(),
});

export const grantSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  scopes: z.array(z.string()),
  resource: z.string().optional(),
});

export type PendingAuthorization = z.infer<typeof pendingAuthorizationSchema>;
export type AuthorizationCode = z.infer<typeof authorizationCodeSchema>;
export type Grant = z.infer<typeof grantSchema>;

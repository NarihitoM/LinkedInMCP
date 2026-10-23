import { z } from "zod";

export const ACCESS_TOKEN_TTL = 24 * 60 * 60;
export const REFRESH_TOKEN_TTL = 90 * 24 * 60 * 60;
export const AUTHORIZATION_CODE_TTL = 5 * 60;
export const AUTHORIZE_TTL = 10 * 60;
export const MCP_SCOPE = "linkedin";

export const memberSchema = z.object({
  sub: z.string(),
  name: z.string(),
  email: z.string().optional(),
  picture: z.string().optional(),
});

export const linkedInTokenSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
});

export const pendingAuthorizationSchema = z.object({
  nonce: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
  codeChallenge: z.string(),
  state: z.string().optional(),
  scopes: z.array(z.string()),
  resource: z.string().optional(),
});

export const grantSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  scopes: z.array(z.string()),
  resource: z.string().optional(),
  member: memberSchema,
  linkedin: linkedInTokenSchema,
});

export const authorizationCodeSchema = grantSchema.extend({
  codeChallenge: z.string(),
  redirectUri: z.string(),
});

export type Member = z.infer<typeof memberSchema>;
export type PendingAuthorization = z.infer<typeof pendingAuthorizationSchema>;
export type AuthorizationCode = z.infer<typeof authorizationCodeSchema>;
export type Grant = z.infer<typeof grantSchema>;

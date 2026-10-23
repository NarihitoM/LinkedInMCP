import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  OAuthClientMetadataSchema,
  type OAuthClientInformationFull,
  type OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { getEnv } from "../../shared/lib/env.ts";
import { randomToken, seal, unseal } from "../../shared/lib/seal.ts";
import { readUser } from "../../shared/lib/userStore.ts";
import { serializeCookie } from "../../shared/utils/cookies.ts";
import {
  ACCESS_TOKEN_TTL,
  AUTHORIZE_TTL,
  MCP_SCOPE,
  REFRESH_TOKEN_TTL,
  authorizationCodeSchema,
  grantSchema,
  type Grant,
  type PendingAuthorization,
} from "./auth.types.ts";
import { buildAuthorizationUrl, CALLBACK_PATH } from "./linkedinOidc.ts";

export const AUTHORIZE_COOKIE = "li_authorize";

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId) {
    const opened = unseal("client", clientId, OAuthClientMetadataSchema);
    return opened ? { ...opened.data, client_id: clientId } : undefined;
  },
  registerClient(client) {
    const metadata = OAuthClientMetadataSchema.parse({ ...client, token_endpoint_auth_method: "none" });
    return {
      ...metadata,
      client_id: seal("client", metadata),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
  },
};

function issueTokens(grant: Grant): OAuthTokens {
  return {
    access_token: seal("access", grant, ACCESS_TOKEN_TTL),
    refresh_token: seal("refresh", grant, REFRESH_TOKEN_TTL),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    scope: grant.scopes.join(" "),
  };
}

async function hasUsableAccount(userId: string): Promise<boolean> {
  const user = await readUser(userId);
  return Boolean(user && user.linkedin.expiresAt > Date.now());
}

function openCode(client: OAuthClientInformationFull, code: string) {
  const opened = unseal("code", code, authorizationCodeSchema);
  if (!opened || opened.data.clientId !== client.client_id) {
    throw new InvalidGrantError("Invalid or expired authorization code");
  }
  return opened.data;
}

export class LinkedInOAuthProvider implements OAuthServerProvider {
  get clientsStore(): OAuthRegisteredClientsStore {
    return clientsStore;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const pending: PendingAuthorization = {
      nonce: randomToken(),
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: params.scopes?.length ? params.scopes : [MCP_SCOPE],
      resource: params.resource?.toString(),
    };

    res.setHeader(
      "Set-Cookie",
      serializeCookie(AUTHORIZE_COOKIE, seal("authorize", pending, AUTHORIZE_TTL), {
        path: CALLBACK_PATH,
        maxAge: AUTHORIZE_TTL,
        httpOnly: true,
        secure: getEnv().BASE_URL.startsWith("https://"),
        sameSite: "Lax",
      }),
    );
    res.redirect(buildAuthorizationUrl(pending.nonce));
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    return openCode(client, authorizationCode).codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const code = openCode(client, authorizationCode);
    if (redirectUri && redirectUri !== code.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }
    return issueTokens({ clientId: code.clientId, userId: code.userId, scopes: code.scopes, resource: code.resource });
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
    const opened = unseal("refresh", refreshToken, grantSchema);
    if (!opened || opened.data.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid or expired refresh token");
    }
    if (!(await hasUsableAccount(opened.data.userId))) {
      throw new InvalidGrantError("LinkedIn sign-in expired or was disconnected. Sign in again.");
    }
    const granted = opened.data.scopes;
    const requested = scopes?.length ? scopes.filter((scope) => granted.includes(scope)) : granted;
    return issueTokens({ ...opened.data, scopes: requested });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const opened = unseal("access", token, grantSchema);
    if (!opened) {
      throw new InvalidTokenError("Invalid or expired access token");
    }
    if (!(await hasUsableAccount(opened.data.userId))) {
      throw new InvalidTokenError("LinkedIn sign-in expired or was disconnected. Sign in again.");
    }
    return {
      token,
      clientId: opened.data.clientId,
      scopes: opened.data.scopes,
      expiresAt: opened.expiresAt,
      ...(opened.data.resource ? { resource: new URL(opened.data.resource) } : {}),
      extra: { userId: opened.data.userId },
    };
  }
}

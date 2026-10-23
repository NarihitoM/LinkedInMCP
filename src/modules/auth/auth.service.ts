import { seal } from "../../shared/lib/seal.ts";
import { readUser, saveUser, userIdFor, type UserRecord } from "../../shared/lib/userStore.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { createConnectUrl } from "../session/index.ts";
import { AUTHORIZATION_CODE_TTL, type AuthorizationCode, type PendingAuthorization } from "./auth.types.ts";
import { exchangeCode, fetchUserInfo } from "./linkedinOidc.ts";

export function redirectWith(target: string, params: Record<string, string | undefined>): string {
  const url = new URL(target);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function completeAuthorization(pending: PendingAuthorization, linkedInCode: string): Promise<string> {
  const token = await exchangeCode(linkedInCode);
  const info = await fetchUserInfo(token.accessToken);
  const id = userIdFor(info.sub);
  const existing = await readUser(id);
  const now = Date.now();

  const record: UserRecord = {
    ...existing,
    id,
    sub: info.sub,
    name: info.name || [info.given_name, info.family_name].filter(Boolean).join(" ") || "LinkedIn member",
    email: info.email,
    picture: info.picture,
    linkedin: token,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await saveUser(record);

  const code: AuthorizationCode = {
    clientId: pending.clientId,
    userId: id,
    codeChallenge: pending.codeChallenge,
    redirectUri: pending.redirectUri,
    scopes: pending.scopes,
    resource: pending.resource,
  };
  const clientRedirect = redirectWith(pending.redirectUri, {
    code: seal("code", code, AUTHORIZATION_CODE_TTL),
    state: pending.state,
  });

  if (record.browser?.status === "active") {
    return clientRedirect;
  }
  return createConnectUrl(id, clientRedirect);
}

export async function getLinkedInAccess(userId: string): Promise<{ accessToken: string; personUrn: string }> {
  const user = await readUser(userId);
  if (!user) {
    throw new ToolError("Your account is not connected. Reconnect the LinkedIn MCP server in Claude.");
  }
  if (user.linkedin.expiresAt <= Date.now()) {
    throw new ToolError("Your LinkedIn sign-in expired. Reconnect the LinkedIn MCP server in Claude to sign in again.");
  }
  return { accessToken: user.linkedin.accessToken, personUrn: `urn:li:person:${user.sub}` };
}

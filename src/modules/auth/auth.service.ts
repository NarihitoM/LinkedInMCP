import { exchangeCode, fetchUserInfo } from "../../shared/lib/linkedinOidc.ts";
import { seal, sha256 } from "../../shared/lib/seal.ts";
import type { ToolContext } from "../../shared/types/tool.ts";
import { ToolError } from "../../shared/utils/errors.ts";
import { AUTHORIZATION_CODE_TTL, type AuthorizationCode, type Member, type PendingAuthorization } from "./auth.types.ts";

export function userIdFor(sub: string): string {
  return sha256(`linkedin:${sub}`).slice(0, 32);
}

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
  const userId = userIdFor(info.sub);
  const member: Member = {
    sub: info.sub,
    name: info.name || [info.given_name, info.family_name].filter(Boolean).join(" ") || "LinkedIn member",
    email: info.email,
    picture: info.picture,
  };

  const code: AuthorizationCode = {
    clientId: pending.clientId,
    userId,
    scopes: pending.scopes,
    resource: pending.resource,
    member,
    linkedin: token,
    codeChallenge: pending.codeChallenge,
    redirectUri: pending.redirectUri,
  };
  return redirectWith(pending.redirectUri, {
    code: seal("code", code, AUTHORIZATION_CODE_TTL),
    state: pending.state,
  });
}

export function getLinkedInAccess(context: ToolContext): { accessToken: string; personUrn: string } {
  if (context.linkedin.expiresAt <= Date.now()) {
    throw new ToolError("Your LinkedIn sign-in expired. Reconnect the LinkedIn MCP server in your client to sign in again.");
  }
  return { accessToken: context.linkedin.accessToken, personUrn: `urn:li:person:${context.member.sub}` };
}

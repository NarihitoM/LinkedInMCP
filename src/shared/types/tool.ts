export interface MemberInfo {
  sub: string;
  name: string;
  email?: string | undefined;
  picture?: string | undefined;
}

export interface LinkedInToken {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface ToolContext {
  userId: string;
  member: MemberInfo;
  linkedin: LinkedInToken;
}

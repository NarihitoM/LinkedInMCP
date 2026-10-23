export class ToolError extends Error {
  override readonly name = "ToolError";
}

export class LoginWallError extends Error {
  override readonly name = "LoginWallError";
  readonly url: string;

  constructor(url: string) {
    super(`LinkedIn redirected to a login or security check page: ${url}`);
    this.url = url;
  }
}

import { Router } from "express";
import { getEnv } from "../../shared/lib/env.ts";
import { renderMessagePage, sendPage } from "../../shared/utils/html.ts";
import { renderConnectPage } from "./connect.page.ts";
import { peekConnectToken } from "./session.service.ts";

export const sessionRouter = Router();

function socketOrigin(): string {
  const origin = new URL(getEnv().BASE_URL);
  return `${origin.protocol === "https:" ? "wss:" : "ws:"}//${origin.host}`;
}

sessionRouter.get("/session/connect", (_req, res) => {
  sendPage(res, renderConnectPage(socketOrigin()));
});

sessionRouter.get("/session/skip", (req, res) => {
  const token = typeof req.query.t === "string" ? req.query.t : "";
  const grant = token ? peekConnectToken(token) : undefined;

  if (grant?.next) {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.redirect(grant.next);
    return;
  }
  sendPage(
    res,
    renderMessagePage("Skipped", "You can connect your LinkedIn browser session later. Claude will give you a link when a tool needs it."),
  );
});

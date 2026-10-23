import { Router } from "express";
import { logger } from "../../shared/lib/logger.ts";
import { unseal } from "../../shared/lib/seal.ts";
import { readCookie, serializeCookie } from "../../shared/utils/cookies.ts";
import { renderMessagePage, sendPage } from "../../shared/utils/html.ts";
import { AUTHORIZE_COOKIE } from "./auth.provider.ts";
import { completeAuthorization, redirectWith } from "./auth.service.ts";
import { pendingAuthorizationSchema } from "./auth.types.ts";
import { CALLBACK_PATH } from "../../shared/lib/linkedinOidc.ts";

export const authRouter = Router();

authRouter.get(CALLBACK_PATH, async (req, res) => {
  const cookie = readCookie(req, AUTHORIZE_COOKIE);
  const pending = cookie ? unseal("authorize", cookie, pendingAuthorizationSchema)?.data : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  res.setHeader("Set-Cookie", serializeCookie(AUTHORIZE_COOKIE, "", { path: CALLBACK_PATH, maxAge: 0, httpOnly: true }));

  if (!pending || state !== pending.nonce) {
    sendPage(res, renderMessagePage("Sign-in expired", "This sign-in link is no longer valid. Start the connection again from Claude."), 400);
    return;
  }

  if (typeof req.query.error === "string") {
    const description = typeof req.query.error_description === "string" ? req.query.error_description : undefined;
    res.redirect(
      redirectWith(pending.redirectUri, { error: "access_denied", error_description: description, state: pending.state }),
    );
    return;
  }

  if (typeof req.query.code !== "string") {
    sendPage(res, renderMessagePage("Sign-in failed", "LinkedIn did not return an authorization code."), 400);
    return;
  }

  try {
    res.redirect(await completeAuthorization(pending, req.query.code));
  } catch (error) {
    logger.error("LinkedIn sign-in failed", { error });
    sendPage(res, renderMessagePage("Sign-in failed", "LinkedIn sign-in could not be completed. Please try again from Claude."), 502);
  }
});

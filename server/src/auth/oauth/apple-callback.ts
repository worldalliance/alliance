import { HttpStatus } from "@nestjs/common";
import { milliseconds } from "date-fns";
import type { Request as ExpressRequest, Response } from "express";
import { APPLE_USER_COOKIE, extractAppleUserFromCookie } from "../tokens";
import type { OAuthCallbackDto } from "./oauth.dto";

/** Only has to survive the bounce below, which is a single redirect. */
const APPLE_USER_COOKIE_MAX_AGE_MS = milliseconds({ minutes: 5 });

/**
 * Apple answers with a cross-site form post, on which the browser withholds
 * lax cookies. Bouncing to a GET on the same URL makes it a top-level
 * navigation, which does carry them.
 */
export function bounceAppleCallback(
  body: OAuthCallbackDto,
  res: Response,
): void {
  // The name rides a cookie rather than the query, which nginx's access log,
  // the request log and the browser's history would each write down.
  const { user, ...bounced } = body;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(bounced)) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }
  if (user) {
    res.cookie(APPLE_USER_COOKIE, user, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: APPLE_USER_COOKIE_MAX_AGE_MS,
    });
  }
  res.redirect(HttpStatus.SEE_OTHER, `?${query}`);
}

/** Read once: the bounce is the only hop the name has to survive. */
export function takeAppleUser(
  req: ExpressRequest,
  res: Response,
): string | undefined {
  const user = extractAppleUserFromCookie(req);
  if (user) {
    res.clearCookie(APPLE_USER_COOKIE, { path: "/" });
  }
  return user;
}

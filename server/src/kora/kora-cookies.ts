import { isDeployed } from "@alliance/common/node-env";
import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export enum KoraCookie {
  Session = "kora_session",
  Code = "kora_code",
  Signup = "kora_signup",
  /** Proofs of the provider sign-ins this browser has open. */
  OAuth = "kora_oauth",
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isDeployed(env("NODE_ENV")),
    // Lax, not strict: the provider's redirect back is a cross-site
    // navigation, and its callback replaces this browser's session.
    sameSite: "lax",
    path: "/",
  };
}

export function setCookie(params: {
  res: Response;
  name: KoraCookie;
  token: string;
  maxAgeMs: number;
}): void {
  params.res.cookie(params.name, params.token, {
    ...cookieOptions(),
    maxAge: params.maxAgeMs,
  });
}

export function clearCookie(res: Response, name: KoraCookie): void {
  res.clearCookie(name, cookieOptions());
}

import { currentNodeEnv, isDeployed } from "@alliance/common/node-env";
import type { CookieOptions, Response } from "express";

export enum KoraCookie {
  Session = "kora_session",
  Code = "kora_code",
  Signup = "kora_signup",
}

function cookieOptions(): CookieOptions {
  const env = currentNodeEnv();
  return {
    httpOnly: true,
    secure: env.ok && isDeployed(env.value),
    sameSite: "strict",
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

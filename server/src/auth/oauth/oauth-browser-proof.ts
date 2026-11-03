import type { Request as ExpressRequest, Response } from "express";
import { extractOAuthStateFromCookie, OAUTH_STATE_COOKIE } from "../tokens";
import type { OAuthState } from "./oauth-auth.service";
import { OAUTH_PROOF_MAX_AGE_MS, spendProof } from "./oauth-proof";

export function setProofCookie(res: Response, proofs: string): void {
  if (!proofs) {
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    return;
  }
  res.cookie(OAUTH_STATE_COOKIE, proofs, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not strict: the callback arrives as a navigation from the
    // provider, and a strict cookie is not sent on one.
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_PROOF_MAX_AGE_MS,
  });
}

export function browserStartedFlow(params: {
  req: ExpressRequest;
  res: Response;
  state: OAuthState;
}): boolean {
  const remaining = spendProof({
    presented: extractOAuthStateFromCookie(params.req),
    proofHash: params.state.proofHash,
  });
  if (remaining === null) {
    return false;
  }
  setProofCookie(params.res, remaining);
  return true;
}

import {
  OAuthError,
  oauthErrorMessage,
  oauthLinkedMessage,
  type OAuthProvider,
} from "@alliance/common/oauth";
import { type Result } from "@alliance/common/result";
import {
  oAuthLinkRedeemHandoff,
  oAuthLinkStartBrowserSession,
  oAuthLinkWithIdentityToken,
  type OAuthLinkDto,
  type UserDto,
} from "@alliance/shared/client";
import { NETWORK_FAILURE_MESSAGE } from "./network";
import { answerResult, ClientFailure, type OAuthFailure } from "./oauthResult";
import { runProviderFlow, type NativeSignIn } from "./oauthSignIn";

export type LinkResult = Result<UserDto, OAuthFailure>;

function linkResult(body: OAuthLinkDto | undefined): LinkResult {
  return answerResult({
    value: body?.user,
    error: body?.error,
    missing: "oauth link answered with no user or known error",
  });
}

/**
 * Connects the provider to the member signed in. The native sheet's request
 * names `userId`, refused if someone else is signed in by then; the browser
 * session binds to whoever started it. Never signs in or out.
 */
export function linkWithProvider(params: {
  provider: OAuthProvider;
  userId: number;
  native: NativeSignIn;
}): Promise<LinkResult> {
  const { provider, userId } = params;
  return runProviderFlow({
    provider,
    native: params.native,
    flow: {
      // Onboarding reports a marked Auth Tab as an unfinished sign-in.
      markAuthTab: false,
      withIdentityToken: (credential) =>
        oAuthLinkWithIdentityToken({
          path: { provider },
          body: { identityToken: credential.identityToken, userId },
        }),
      startBrowserSession: () =>
        oAuthLinkStartBrowserSession({ path: { provider } }),
      redeem: (body) => oAuthLinkRedeemHandoff({ path: { provider }, body }),
      result: linkResult,
    },
  });
}

export type LinkFeedback = { ok: boolean; message: string };

/** Null for a cancellation, which leaves settings as they were. */
export function linkFeedback(params: {
  provider: OAuthProvider;
  result: LinkResult;
}): LinkFeedback | null {
  if (params.result.ok) {
    return { ok: true, message: oauthLinkedMessage(params.provider) };
  }
  const failure = params.result.error;
  if (failure === OAuthError.Cancelled) {
    return null;
  }
  return {
    ok: false,
    message:
      failure === ClientFailure.Network
        ? NETWORK_FAILURE_MESSAGE
        : oauthErrorMessage(params.provider, failure),
  };
}

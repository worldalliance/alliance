import { OAuthError, type OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import {
  oAuthRedeemMobileHandoff,
  oAuthSignInWithIdentityToken,
  oAuthStartMobileBrowserSession,
  type MobileOAuthSignInDto,
} from "@alliance/shared/client";
import {
  handoffFromReturnLink,
  reportOAuthFailure,
  requestFailure,
  sessionResult,
  type SignInResult,
} from "./oauthResult";

export type NativeCredential = { identityToken: string };

/** The native steps, passed in so bun can test the flow without native code. */
export type NativeSignIn = {
  /** Null when this device has no native sheet for the provider. */
  credential: Record<
    OAuthProvider,
    () => Promise<Result<NativeCredential, OAuthError> | null>
  >;
  openBrowserSession: (params: {
    url: string;
    returnTo: string;
  }) => Promise<Result<string, OAuthError>>;
};

async function session(
  request: Promise<{ data?: MobileOAuthSignInDto }>,
): Promise<SignInResult> {
  const response = await R.fromPromise(request, requestFailure);
  return response.ok ? sessionResult(response.value.data) : response;
}

async function signInInBrowser(params: {
  provider: OAuthProvider;
  guestToken: string | undefined;
  native: NativeSignIn;
}): Promise<SignInResult> {
  const { provider, guestToken } = params;
  const started = await R.fromPromise(
    oAuthStartMobileBrowserSession({ path: { provider } }),
    requestFailure,
  );
  if (!started.ok) {
    return started;
  }
  if (!started.value.data) {
    reportOAuthFailure("oauth browser session started with no body");
    return R.failure(OAuthError.Failed);
  }
  const { url, proof, returnTo } = started.value.data;

  const returned = await params.native.openBrowserSession({ url, returnTo });
  if (!returned.ok) {
    return returned;
  }

  const handoff = handoffFromReturnLink(returned.value);
  if (!handoff.ok) {
    return handoff;
  }
  return session(
    oAuthRedeemMobileHandoff({
      path: { provider },
      body: { handoff: handoff.value, proof, guestToken },
    }),
  );
}

/**
 * Sign-in only: a provider address with no Alliance account comes back as
 * `OAuthError.NoAccount`, never as a new account.
 */
export async function signInWithProvider(params: {
  provider: OAuthProvider;
  guestToken: string | undefined;
  native: NativeSignIn;
}): Promise<SignInResult> {
  const credential = await params.native.credential[params.provider]();
  if (credential === null) {
    return signInInBrowser(params);
  }
  if (!credential.ok) {
    return credential;
  }
  return session(
    oAuthSignInWithIdentityToken({
      path: { provider: params.provider },
      body: { ...credential.value, guestToken: params.guestToken },
    }),
  );
}

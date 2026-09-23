import { OAuthError, type OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import {
  oAuthRedeemMobileHandoff,
  oAuthSignInWithIdentityToken,
  oAuthStartMobileBrowserSession,
  type MobileOAuthBrowserSessionDto,
} from "@alliance/shared/client";
import {
  handoffFromReturnLink,
  reportOAuthFailure,
  requestFailure,
  sessionResult,
  type OAuthFailure,
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
    markAuthTab: boolean;
  }) => Promise<Result<string, OAuthError>>;
};

type ProviderFlow<B, T> = {
  markAuthTab: boolean;
  withIdentityToken: (credential: NativeCredential) => Promise<{ data?: B }>;
  startBrowserSession: () => Promise<{ data?: MobileOAuthBrowserSessionDto }>;
  redeem: (body: { handoff: string; proof: string }) => Promise<{ data?: B }>;
  result: (body: B | undefined) => Result<T, OAuthFailure>;
};

async function answer<B, T>(params: {
  request: Promise<{ data?: B }>;
  flow: ProviderFlow<B, T>;
}): Promise<Result<T, OAuthFailure>> {
  const response = await R.fromPromise(params.request, requestFailure);
  return response.ok ? params.flow.result(response.value.data) : response;
}

async function runInBrowser<B, T>(params: {
  native: NativeSignIn;
  flow: ProviderFlow<B, T>;
}): Promise<Result<T, OAuthFailure>> {
  const started = await R.fromPromise(
    params.flow.startBrowserSession(),
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

  const returned = await params.native.openBrowserSession({
    url,
    returnTo,
    markAuthTab: params.flow.markAuthTab,
  });
  if (!returned.ok) {
    return returned;
  }

  const handoff = handoffFromReturnLink(returned.value);
  if (!handoff.ok) {
    return handoff;
  }
  return answer({
    request: params.flow.redeem({ handoff: handoff.value, proof }),
    flow: params.flow,
  });
}

export async function runProviderFlow<B, T>(params: {
  provider: OAuthProvider;
  native: NativeSignIn;
  flow: ProviderFlow<B, T>;
}): Promise<Result<T, OAuthFailure>> {
  const credential = await params.native.credential[params.provider]();
  if (credential === null) {
    return runInBrowser(params);
  }
  if (!credential.ok) {
    return credential;
  }
  return answer({
    request: params.flow.withIdentityToken(credential.value),
    flow: params.flow,
  });
}

/**
 * Sign-in only: a provider address with no Alliance account comes back as
 * `OAuthError.NoAccount`, never as a new account.
 */
export function signInWithProvider(params: {
  provider: OAuthProvider;
  guestToken: string | undefined;
  native: NativeSignIn;
}): Promise<SignInResult> {
  const { provider, guestToken } = params;
  return runProviderFlow({
    provider,
    native: params.native,
    flow: {
      markAuthTab: true,
      withIdentityToken: (credential) =>
        oAuthSignInWithIdentityToken({
          path: { provider },
          body: { ...credential, guestToken },
        }),
      startBrowserSession: () =>
        oAuthStartMobileBrowserSession({ path: { provider } }),
      redeem: (body) =>
        oAuthRedeemMobileHandoff({
          path: { provider },
          body: { ...body, guestToken },
        }),
      result: sessionResult,
    },
  });
}

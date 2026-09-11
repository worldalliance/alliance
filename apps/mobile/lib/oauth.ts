import {
  MOBILE_OAUTH_RETURN_URL,
  OAUTH_HANDOFF_PARAM,
  OAuthError,
  OAuthIntent,
  OAuthProvider,
  oauthErrorMessage,
  oauthErrorParam,
  oauthOutcomeParam,
  parseOAuthError,
  parseOAuthOutcome,
  type OAuthOutcome,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { oAuthStart } from "@alliance/shared/client";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { z } from "zod";

/** Set in app.config.js, which also derives the iOS URL scheme from it. */
const oauthConfig = z
  .object({
    googleWebClientId: z.string(),
    googleIosClientId: z.string(),
  })
  .parse(Constants.expoConfig?.extra?.oauth);

// The web client id as server client, so the id token's audience is the one
// the server verifies whichever platform it came from.
GoogleSignin.configure({
  webClientId: oauthConfig.googleWebClientId,
  iosClientId: oauthConfig.googleIosClientId,
});

export class OAuthSignInError extends Error {
  constructor(
    readonly provider: OAuthProvider,
    readonly error: OAuthError,
  ) {
    super(oauthErrorMessage(provider, error));
  }
}

export type OAuthSignIn =
  /** The SDK handed the app a token the server verifies directly. */
  | { kind: "native"; identityToken: string; name: string | null }
  /** The system browser ran the server flow and deep-linked a handoff back. */
  | { kind: "handoff"; outcome: OAuthOutcome; handoff: string; proof: string };

const asString = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

/**
 * Apple has no sign-in of its own on Android, so that one pair runs the same
 * server flow the web apps use, in the system browser. The secret the browser
 * would hold in a cookie comes back from the start call instead, and the deep
 * link is worth nothing without it.
 */
export async function signInWith(params: {
  provider: OAuthProvider;
  intent: OAuthIntent;
  referralCode?: string | null;
}): Promise<Result<OAuthSignIn, OAuthError>> {
  switch (params.provider) {
    case OAuthProvider.Google:
      return signInWithGoogle();
    case OAuthProvider.Apple:
      return Platform.OS === "ios" ? signInWithApple() : runBrowserFlow(params);
    default:
      throw new Error(`unknown provider: ${params.provider satisfies never}`);
  }
}

async function signInWithGoogle(): Promise<Result<OAuthSignIn, OAuthError>> {
  const response = await R.fromPromiseFn(async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Signed out first so the account picker shows every time, as the web
    // flow's select_account prompt does.
    await GoogleSignin.signOut();
    return GoogleSignin.signIn();
  });
  if (!response.ok) {
    console.error("google sign-in failed", response.error);
    return R.failure(OAuthError.Failed);
  }
  if (response.value.type !== "success") {
    return R.failure(OAuthError.Cancelled);
  }
  const { idToken, user } = response.value.data;
  if (!idToken) {
    return R.failure(OAuthError.Failed);
  }
  return R.success({ kind: "native", identityToken: idToken, name: user.name });
}

const isAppleCancel = (error: Error): boolean =>
  "code" in error && error.code === "ERR_REQUEST_CANCELED";

async function signInWithApple(): Promise<Result<OAuthSignIn, OAuthError>> {
  const credential = await R.fromPromise(
    AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    }),
  );
  if (!credential.ok) {
    if (isAppleCancel(credential.error)) {
      return R.failure(OAuthError.Cancelled);
    }
    console.error("apple sign-in failed", credential.error);
    return R.failure(OAuthError.Failed);
  }
  const { identityToken, fullName } = credential.value;
  if (!identityToken) {
    return R.failure(OAuthError.Failed);
  }
  const name = [fullName?.givenName, fullName?.familyName]
    .filter((part) => part)
    .join(" ");
  return R.success({ kind: "native", identityToken, name: name || null });
}

async function runBrowserFlow(params: {
  provider: OAuthProvider;
  intent: OAuthIntent;
  referralCode?: string | null;
}): Promise<Result<OAuthSignIn, OAuthError>> {
  const { provider } = params;
  const started = await oAuthStart({
    path: { provider },
    body: {
      intent: params.intent,
      returnTo: MOBILE_OAUTH_RETURN_URL,
      timeZone: deviceTimeZone(),
      referralCode: params.referralCode ?? undefined,
    },
  });
  if (!started.data) {
    return R.failure(OAuthError.Failed);
  }
  const { consentUrl, proof } = started.data;

  const session = await WebBrowser.openAuthSessionAsync(
    consentUrl,
    MOBILE_OAUTH_RETURN_URL,
  );
  if (session.type !== "success") {
    return R.failure(OAuthError.Cancelled);
  }

  const { queryParams } = Linking.parse(session.url);
  const error = parseOAuthError(
    asString(queryParams?.[oauthErrorParam(provider)]),
  );
  if (error) {
    return R.failure(error);
  }

  const outcome = parseOAuthOutcome(
    asString(queryParams?.[oauthOutcomeParam(provider)]),
  );
  const handoff = asString(queryParams?.[OAUTH_HANDOFF_PARAM]);
  if (!outcome || !handoff) {
    return R.failure(OAuthError.Failed);
  }
  return R.success({ kind: "handoff", outcome, handoff, proof });
}

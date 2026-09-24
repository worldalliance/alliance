import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleSignin,
  isCancelledResponse,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { authTab } from "../modules/auth-tab";
import { linkWithProvider, type LinkResult } from "./oauthLink";
import {
  AuthTabFlow,
  reportOAuthFailure,
  returnLinkFromAuthTab,
  returnLinkFromBrowser,
  takeInterruptedAuthTab as takeInterrupted,
  whileAuthTabOpen,
  type SignInResult,
} from "./oauthResult";
import {
  signInWithProvider as signIn,
  type NativeCredential,
  type NativeSignIn,
} from "./oauthSignIn";

const APPLE_CANCELLED_CODE = "ERR_REQUEST_CANCELED";

/**
 * Public ids, under APIs & Services > Credentials in the Google Cloud console.
 * Tokens carry the web client as their audience, so this has to stay equal to
 * the server's `GOOGLE_CLIENT_ID`, which is what it verifies them against.
 * Android clients match on package name and signing certificate, so the app
 * never names them.
 */
const GOOGLE_WEB_CLIENT_ID =
  "498109422267-jla0nu3g91hpj838dj54di7hd09dmjgv.apps.googleusercontent.com";

async function googleCredential(): Promise<Result<
  NativeCredential,
  OAuthError
> | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }
  const extraIosClientId: unknown =
    Constants.expoConfig?.extra?.googleIosClientId;
  const iosClientId =
    typeof extraIosClientId === "string" ? extraIosClientId : undefined;
  if (Platform.OS === "ios" && !iosClientId) {
    reportOAuthFailure("no googleIosClientId in the app config's extra");
    return R.failure(OAuthError.Failed);
  }
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId });
  const playServices = await R.fromPromise(
    GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }),
  );
  if (!playServices.ok) {
    return null;
  }

  const response = await R.fromPromise(GoogleSignin.signIn(), (error) => error);
  // Otherwise the SDK signs straight back into this account next time, and a
  // member told it has no Alliance account can't pick another.
  await R.fromPromise(GoogleSignin.signOut());

  if (!response.ok) {
    reportOAuthFailure("google sign-in failed", response.error);
    return R.failure(OAuthError.Failed);
  }
  if (isCancelledResponse(response.value)) {
    return R.failure(OAuthError.Cancelled);
  }
  const { idToken } = response.value.data;
  if (!idToken) {
    reportOAuthFailure("google sign-in returned no id token");
    return R.failure(OAuthError.Failed);
  }
  return R.success({ identityToken: idToken });
}

/** Null when this device has no native sheet for Apple, which is every Android one. */
async function appleCredential(): Promise<Result<
  NativeCredential,
  OAuthError
> | null> {
  if (
    Platform.OS !== "ios" ||
    !(await AppleAuthentication.isAvailableAsync())
  ) {
    return null;
  }

  const credential = await R.fromPromise(
    AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    }),
    (error) => error,
  );
  if (!credential.ok) {
    if (
      credential.error instanceof Error &&
      "code" in credential.error &&
      credential.error.code === APPLE_CANCELLED_CODE
    ) {
      return R.failure(OAuthError.Cancelled);
    }
    reportOAuthFailure("apple sign-in failed", credential.error);
    return R.failure(OAuthError.Failed);
  }
  const { identityToken } = credential.value;
  if (!identityToken) {
    reportOAuthFailure("apple sign-in returned no identity token");
    return R.failure(OAuthError.Failed);
  }
  return R.success({ identityToken });
}

async function openBrowserSession(params: {
  url: string;
  returnTo: string;
  authTabFlow: AuthTabFlow;
}): Promise<Result<string, OAuthError>> {
  const tab = authTab();
  if (tab) {
    return returnLinkFromAuthTab(
      await whileAuthTabOpen({
        storage: AsyncStorage,
        flow: params.authTabFlow,
        open: () => tab.open({ url: params.url, redirectUrl: params.returnTo }),
      }),
    );
  }
  return returnLinkFromBrowser(
    await WebBrowser.openAuthSessionAsync(params.url, params.returnTo),
  );
}

export const takeInterruptedAuthTab = (flow: AuthTabFlow) =>
  takeInterrupted(AsyncStorage, flow);

const NATIVE: NativeSignIn = {
  credential: {
    [OAuthProvider.Google]: googleCredential,
    [OAuthProvider.Apple]: appleCredential,
  },
  openBrowserSession,
};

export function signInWithProvider(params: {
  provider: OAuthProvider;
  guestToken: string | undefined;
}): Promise<SignInResult> {
  return signIn({ ...params, native: NATIVE });
}

export function linkProvider(params: {
  provider: OAuthProvider;
  userId: number;
}): Promise<LinkResult> {
  return linkWithProvider({ ...params, native: NATIVE });
}

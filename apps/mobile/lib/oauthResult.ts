import { ExceptionEvent } from "@alliance/common/analytics";
import {
  MOBILE_OAUTH_ERROR_PARAM,
  MOBILE_OAUTH_HANDOFF_PARAM,
  MOBILE_OAUTH_RETURN_PATH,
  MOBILE_OAUTH_RETURN_URL,
  OAUTH_ERROR_MESSAGE,
  OAUTH_PROVIDER_LABEL,
  OAuthError,
  parseOAuthError,
  type OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { isAllianceAppHostname } from "@alliance/common/url";
import type {
  MobileOAuthSignInDto,
  SessionTokensDto,
} from "@alliance/shared/client";
import { captureException } from "@alliance/shared/lib/analytics";
import {
  WebBrowserResultType,
  type WebBrowserAuthSessionResult,
} from "expo-web-browser/build/WebBrowser.types";
import {
  AuthTabResultType,
  type AuthTabResult,
} from "../modules/auth-tab/src/AuthTab.types";
import { isNetworkFailure, NETWORK_FAILURE_MESSAGE } from "./network";

export enum ClientFailure {
  Network = "network",
}

export type OAuthFailure = OAuthError | ClientFailure;

export type SignInResult = Result<SessionTokensDto, OAuthFailure>;

export enum FailureTone {
  Notice = "notice",
  Error = "error",
}

export type ProviderFailure = { tone: FailureTone; message: string };

/** Logs and reports, since a release build's console reaches no one. */
export function reportOAuthFailure(
  message: string,
  ...details: unknown[]
): void {
  console.error(message, ...details);
  captureException(
    ExceptionEvent.OAuthFailed,
    new Error(message, {
      cause: details.find((detail) => detail instanceof Error),
    }),
    {
      details: details.map((detail) =>
        typeof detail === "string" || detail instanceof Error
          ? String(detail)
          : JSON.stringify(detail),
      ),
    },
  );
}

const FAILURE_TONE: Record<OAuthFailure, FailureTone> = {
  [OAuthError.Cancelled]: FailureTone.Notice,
  [OAuthError.Failed]: FailureTone.Error,
  [OAuthError.NoAccount]: FailureTone.Error,
  [OAuthError.EmailNotVerified]: FailureTone.Error,
  [OAuthError.ClaimedByAnotherAccount]: FailureTone.Error,
  [OAuthError.InviteRequired]: FailureTone.Error,
  [OAuthError.LastSignInMethod]: FailureTone.Error,
  [OAuthError.ProviderAlreadyConnected]: FailureTone.Error,
  [OAuthError.Expired]: FailureTone.Error,
  [ClientFailure.Network]: FailureTone.Error,
};

export const requestFailure = (error: unknown): OAuthFailure => {
  if (isNetworkFailure(error)) {
    return ClientFailure.Network;
  }
  reportOAuthFailure("oauth request failed", error);
  return OAuthError.Failed;
};

// The profile load after the server issues tokens wraps the fetch error in `cause`.
export const thrownFailure = (error: unknown): OAuthFailure => {
  if (error instanceof Error && isNetworkFailure(error.cause)) {
    return ClientFailure.Network;
  }
  reportOAuthFailure("oauth flow threw", error);
  return OAuthError.Failed;
};

export function answerResult<T>(params: {
  value: T | undefined;
  error: unknown;
  missing: string;
}): Result<T, OAuthFailure> {
  if (params.value) {
    return R.success(params.value);
  }
  const error = parseOAuthError(params.error);
  if (!error) {
    reportOAuthFailure(params.missing);
  }
  return R.failure(error ?? OAuthError.Failed);
}

export function sessionResult(
  body: MobileOAuthSignInDto | undefined,
): SignInResult {
  return answerResult({
    value: body?.session,
    error: body?.error,
    missing: "oauth sign-in answered with no session or known error",
  });
}

export function handoffFromReturnLink(url: string): Result<string, OAuthError> {
  const link = R.fromThrowable(() => new URL(url));
  if (!link.ok) {
    // The link carries the handoff, so it stays out of the log.
    reportOAuthFailure("oauth return link did not parse");
    return R.failure(OAuthError.Failed);
  }
  const params = link.value.searchParams;
  const handoff = params.get(MOBILE_OAUTH_HANDOFF_PARAM);
  if (handoff) {
    return R.success(handoff);
  }
  const error = parseOAuthError(params.get(MOBILE_OAUTH_ERROR_PARAM));
  if (!error) {
    reportOAuthFailure("oauth return link carried no handoff or known error");
  }
  return R.failure(error ?? OAuthError.Failed);
}

export function returnLinkFromAuthTab(
  result: AuthTabResult,
): Result<string, OAuthError> {
  switch (result.type) {
    case AuthTabResultType.Success:
      if (!result.url) {
        reportOAuthFailure("auth tab succeeded with no url");
        return R.failure(OAuthError.Failed);
      }
      return R.success(result.url);
    case AuthTabResultType.Cancel:
      return R.failure(OAuthError.Cancelled);
    case AuthTabResultType.VerificationFailed:
    case AuthTabResultType.VerificationTimedOut:
    case AuthTabResultType.Unknown:
      reportOAuthFailure("auth tab failed", result.type, result.resultCode);
      return R.failure(OAuthError.Failed);
    default:
      throw new Error(
        `unknown auth tab result: ${result.type satisfies never}`,
      );
  }
}

export function returnLinkFromBrowser(
  result: WebBrowserAuthSessionResult,
): Result<string, OAuthError> {
  const { type } = result;
  switch (type) {
    case "success":
      return R.success(result.url);
    case WebBrowserResultType.CANCEL:
    case WebBrowserResultType.DISMISS:
      return R.failure(OAuthError.Cancelled);
    case WebBrowserResultType.OPENED:
    case WebBrowserResultType.LOCKED:
      reportOAuthFailure("browser session failed", type);
      return R.failure(OAuthError.Failed);
    default:
      throw new Error(
        `unknown browser session result: ${type satisfies never}`,
      );
  }
}

const SCHEME_RETURN_URL = new URL(MOBILE_OAUTH_RETURN_URL);

export function isOAuthReturnLink(path: string): boolean {
  const url = R.fromThrowable(() => new URL(path, "http://app.invalid"));
  if (!url.ok) {
    return false;
  }
  const { protocol, hostname, pathname } = url.value;
  if (protocol === SCHEME_RETURN_URL.protocol) {
    return (
      hostname === SCHEME_RETURN_URL.hostname &&
      (pathname === "" || pathname === "/")
    );
  }
  return (
    protocol === "https:" &&
    isAllianceAppHostname(hostname) &&
    pathname === MOBILE_OAUTH_RETURN_PATH
  );
}

/** Names every provider: the flow that knew which one died with the process. */
const ANY_PROVIDER_LABEL = "Google or Apple";

const UNFINISHED = "unfinished";

export const UNFINISHED_FAILURE: ProviderFailure = {
  tone: FailureTone.Error,
  message: "That sign-in didn't finish. Please try again.",
};

/**
 * What `app/+native-intent.tsx` exports. Routing a return link would unmount
 * the login screen waiting on it. One that opens the app has no screen waiting:
 * Android killed the process during the browser session, so it goes to the gate.
 */
export function oauthReturnRedirect(params: {
  path: string;
  initial: boolean;
}): string | null {
  if (!isOAuthReturnLink(params.path)) {
    return params.path;
  }
  if (!params.initial) {
    return null;
  }
  const handoff = handoffFromReturnLink(params.path);
  return `/onboarding?oauthInterrupted=${handoff.ok ? UNFINISHED : handoff.error}`;
}

export function interruptedFailure(reason: string): ProviderFailure {
  const failure = parseOAuthError(reason);
  if (!failure) {
    return UNFINISHED_FAILURE;
  }
  return providerFailureFor({ provider: null, failure });
}

type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const AUTH_TAB_OPEN_KEY = "oauthAuthTabOpen";

// Tells the marker this launch wrote apart from one a killed launch left.
const LAUNCH_ID = `${Date.now()}-${Math.random()}`;

/**
 * An Auth Tab returns its result to the process that opened it, so a process
 * Android kills while it is open leaves no link to route. The marker is what
 * the next launch finds instead.
 */
export async function whileAuthTabOpen<T>(
  storage: KeyValueStorage,
  open: () => Promise<T>,
): Promise<T> {
  const marked = await R.fromPromise(
    storage.setItem(AUTH_TAB_OPEN_KEY, LAUNCH_ID),
  );
  if (!marked.ok) {
    reportOAuthFailure("couldn't mark the auth tab open", marked.error);
  }
  try {
    return await open();
  } finally {
    const cleared = await R.fromPromise(storage.removeItem(AUTH_TAB_OPEN_KEY));
    if (!cleared.ok) {
      reportOAuthFailure("couldn't clear the auth tab marker", cleared.error);
    }
  }
}

/** True once for an Auth Tab an earlier launch opened and never heard back from. */
export async function takeInterruptedAuthTab(
  storage: KeyValueStorage,
): Promise<boolean> {
  const marker = await R.fromPromise(storage.getItem(AUTH_TAB_OPEN_KEY));
  if (!marker.ok) {
    reportOAuthFailure("couldn't read the auth tab marker", marker.error);
    return false;
  }
  if (marker.value === null || marker.value === LAUNCH_ID) {
    return false;
  }
  const cleared = await R.fromPromise(storage.removeItem(AUTH_TAB_OPEN_KEY));
  if (!cleared.ok) {
    reportOAuthFailure("couldn't clear the auth tab marker", cleared.error);
  }
  return true;
}

export function providerFailureFor(params: {
  /** Null when the provider isn't known. */
  provider: OAuthProvider | null;
  failure: OAuthFailure;
}): ProviderFailure {
  return {
    tone: FAILURE_TONE[params.failure],
    message: oauthFailureMessage(params),
  };
}

function oauthFailureMessage(params: {
  provider: OAuthProvider | null;
  failure: OAuthFailure;
}): string {
  const label = params.provider
    ? OAUTH_PROVIDER_LABEL[params.provider]
    : ANY_PROVIDER_LABEL;
  switch (params.failure) {
    case ClientFailure.Network:
      return NETWORK_FAILURE_MESSAGE;
    case OAuthError.NoAccount:
      return `We couldn't find an Alliance account for that ${label} address. Try a different Google or Apple account, or log in with your email and password.`;
    // The web copy points at a disconnect control mobile doesn't have.
    case OAuthError.ProviderAlreadyConnected:
      return `Your Alliance account is connected to a different ${label} account. Continue with that one, or log in with your email and password.`;
    default:
      return OAUTH_ERROR_MESSAGE[params.failure](label);
  }
}

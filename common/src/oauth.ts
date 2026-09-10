import { z } from "zod";

export enum OAuthProvider {
  Google = "google",
  Apple = "apple",
}

export const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = {
  [OAuthProvider.Google]: "Google",
  [OAuthProvider.Apple]: "Apple",
};

export enum OAuthIntent {
  Authenticate = "authenticate",
  Link = "link",
}

/**
 * Appended by the callback when it sends the caller back, named after the
 * provider so one page can tell `?google=linked` from `?apple=linked`.
 */
export const oauthOutcomeParam = (provider: OAuthProvider): string => provider;
export const oauthErrorParam = (provider: OAuthProvider): string =>
  `${provider}Error`;

export enum OAuthOutcome {
  SignedIn = "signed_in",
  SignedUp = "signed_up",
  Linked = "linked",
}

export enum OAuthError {
  Cancelled = "cancelled",
  Failed = "failed",
  NoAccount = "no_account",
  EmailNotVerified = "email_not_verified",
  ClaimedByAnotherAccount = "claimed_by_another_account",
  InviteRequired = "invite_required",
  LastSignInMethod = "last_sign_in_method",
  ProviderAlreadyConnected = "provider_already_connected",
}

export const parseOAuthProvider = (value: unknown): OAuthProvider | null =>
  z.enum(OAuthProvider).safeParse(value).data ?? null;

const ERROR_MESSAGE: Record<OAuthError, (label: string) => string> = {
  [OAuthError.Cancelled]: (label) => `${label} sign-in was cancelled.`,
  [OAuthError.Failed]: (label) => `${label} sign-in failed. Please try again.`,
  [OAuthError.NoAccount]: (label) =>
    `No Alliance account uses that ${label} address. The Alliance is invite-only, so ask whoever invited you for a link.`,
  [OAuthError.EmailNotVerified]: (label) =>
    `${label} has not verified that email address, so we can't use it to sign in.`,
  [OAuthError.ClaimedByAnotherAccount]: (label) =>
    `That ${label} account is already linked to a different Alliance account.`,
  [OAuthError.InviteRequired]: () =>
    "You need an invite link to create an account.",
  [OAuthError.LastSignInMethod]: (label) =>
    `${label} is the only way into your account. Set a password or connect another account first.`,
  [OAuthError.ProviderAlreadyConnected]: (label) =>
    `A different ${label} account is already connected to your Alliance account. Disconnect that one first.`,
};

export function oauthErrorMessage(
  provider: OAuthProvider,
  error: OAuthError,
): string {
  return ERROR_MESSAGE[error](OAUTH_PROVIDER_LABEL[provider]);
}

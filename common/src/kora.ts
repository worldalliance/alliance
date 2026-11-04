import {
  OAUTH_PROVIDER_LABEL,
  OAuthError,
  oauthErrorMessage,
  type OAuthProvider,
} from "./oauth";

export const KORA_PROJECT_PATH = "/projects/safer-chatbots-for-children";

/** The `error` field of a refused Kora participant request, for clients to branch on. */
export enum KoraError {
  SignupExpired = "kora_signup_expired",
}

/** The member copy for some errors mentions invites and member accounts, which participants have neither of. */
export function koraOAuthErrorMessage(
  provider: OAuthProvider,
  error: OAuthError,
): string {
  switch (error) {
    case OAuthError.Cancelled:
    case OAuthError.Failed:
    case OAuthError.Expired:
      return oauthErrorMessage(provider, error);
    case OAuthError.EmailNotVerified:
      return `${OAUTH_PROVIDER_LABEL[provider]} hasn’t verified that email address. Continue with your email or mobile number instead.`;
    case OAuthError.NoAccount:
    case OAuthError.ClaimedByAnotherAccount:
    case OAuthError.InviteRequired:
    case OAuthError.LastSignInMethod:
    case OAuthError.ProviderAlreadyConnected:
    case OAuthError.ReviewAccount:
      return oauthErrorMessage(provider, OAuthError.Failed);
    default:
      throw new Error(`unknown oauth error: ${error satisfies never}`);
  }
}

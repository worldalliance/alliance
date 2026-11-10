import {
  OAUTH_PROVIDER_LABEL,
  OAuthError,
  oauthErrorMessage,
  type OAuthProvider,
} from "./oauth";

export const KORA_PROJECT_PATH = "/projects/safer-chatbots-for-children";

export const KORA_REVIEW_PATH = `${KORA_PROJECT_PATH}/review`;

export enum KoraProjectStatus {
  Pending = "pending",
  Active = "active",
  Closed = "closed",
}

export const KORA_ACTIVE_NEEDS_TRANSCRIPTS =
  "Upload transcripts before making the project active.";

export const KORA_UPLOAD_NEEDS_BOTH_FILES =
  "Choose both the transcripts file and the export schema.";

export const KORA_NOTIFY_NEEDS_ACTIVE =
  "Make the project active before notifying the waitlist.";

/** Where a reviewer is: reviewing an assignment, finished, out of transcripts, or before the project is active. */
export enum KoraReviewPhase {
  Reviewing = "reviewing",
  Finished = "finished",
  NoneLeft = "none_left",
  NotActive = "not_active",
}

export enum KoraReviewStatus {
  Pending = "pending",
  Done = "done",
  OptedOut = "opted_out",
}

/** The `error` field of a refused Kora participant request, for clients to branch on. */
export enum KoraError {
  SignupExpired = "kora_signup_expired",
  ProjectClosed = "kora_project_closed",
}

export const KORA_SIGNUPS_CLOSED =
  "The project has closed, so it isn’t taking new sign-ups.";

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
    // Kora sign-in fails with NoAccount only for a new participant while the project is closed.
    case OAuthError.NoAccount:
      return KORA_SIGNUPS_CLOSED;
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

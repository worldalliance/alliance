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

export const KORA_ACTIVE_NEEDS_CONVERSATIONS =
  "Upload conversations before making the project active.";

export const KORA_UPLOAD_NEEDS_CONVERSATIONS = "Choose the conversations file.";

export const KORA_NOTIFY_NEEDS_ACTIVE =
  "Make the project active before notifying the waitlist.";

/** Where a reviewer is: reviewing an assignment, finished, out of transcripts, or before the project is active. */
export enum KoraReviewPhase {
  /** The sign-up screens: demographics, risk opt-out, extended opt-in, consent. */
  Onboarding = "onboarding",
  Reviewing = "reviewing",
  Finished = "finished",
  NoneLeft = "none_left",
  NotActive = "not_active",
}

/** What a conversation is in the import: spec 6.0 Annex B. `test` material is never exported. */
export enum KoraItemType {
  Scored = "scored",
  Practice = "practice",
  Attention = "attention",
  Test = "test",
}

/** What the reviewer is told a conversation is. An attention item arrives as a rated one. */
export enum KoraItemKind {
  Practice = "practice",
  Rated = "rated",
}

/** Why the host stopped giving a session conversations (spec 6.0 section 7). */
export enum KoraSessionEnd {
  BudgetSpent = "budget_spent",
  QueueEmpty = "queue_empty",
}

/** A session's load budget, and what a conversation costs it (spec 6.0 section 7). */
export const KORA_SESSION_BUDGET_UNITS = 5;
export const KORA_SHORT_UNITS = 1;
export const KORA_EXTENDED_UNITS = 1.8;
/** Above this many AI turns a conversation is extended: longer, and behind the opt-in (section 5). */
export const KORA_SHORT_TURNS = 3;
/** A session never serves fewer than this, whatever the budget says. */
export const KORA_MIN_CONVERSATIONS = 3;
/** The two practice conversations come first, in the reviewer's first session only (section 3.5). */
export const KORA_PRACTICE_COUNT = 2;

export const koraWeightUnits = (nTurns: number): number =>
  nTurns > KORA_SHORT_TURNS ? KORA_EXTENDED_UNITS : KORA_SHORT_UNITS;

export enum KoraReviewStatus {
  Pending = "pending",
  Done = "done",
  OptedOut = "opted_out",
  /** Left unfinished past the release window, so it went back to the pool and out of the assignment. */
  Released = "released",
}

/** A row on the participant's home base: an offered user-batch, or one of their assignments. */
export enum KoraUserBatchStatus {
  Ready = "ready",
  Open = "open",
  Done = "done",
  Closed = "closed",
}

export const KORA_EXAMPLE_PATH = `${KORA_REVIEW_PATH}/example`;

/** Where a reviewer edits which risks they see and whether longer conversations are among them. */
export const KORA_ACCOUNT_PATH = `${KORA_PROJECT_PATH}/account`;

export enum KoraBatchEventKind {
  Upload = "upload",
  Retire = "retire",
  Reactivate = "reactivate",
  Delete = "delete",
  AssignmentCompleted = "assignment_completed",
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

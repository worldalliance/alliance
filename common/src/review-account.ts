/**
 * What production's `POST /auth/login` refuses a review account with once its
 * password checks out. The web login matches on it to hand the account to
 * staging instead.
 */
export const REVIEW_ACCOUNT_MESSAGE =
  "This review account requires an updated app or the staging website.";

export const REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE =
  "Review sign-in is temporarily unavailable. Please try again later.";

/** Staging's web review sign-in returns a failure to `/login` under this query parameter. */
export const REVIEW_SIGN_IN_FAILED_PARAM = "reviewSignInFailed";

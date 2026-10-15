import { REVIEW_ACCOUNT_MESSAGE } from "@alliance/common/review-account";

/** The password checked out for an app-store review account, which signs in
 * on staging instead. */
export class ReviewAccountError extends Error {
  constructor() {
    super(REVIEW_ACCOUNT_MESSAGE);
    this.name = "ReviewAccountError";
  }
}

export class ReviewSignInUnavailableError extends Error {
  constructor(cause: Error) {
    super("Staging refused or missed a review account sign-in", { cause });
    this.name = "ReviewSignInUnavailableError";
  }
}

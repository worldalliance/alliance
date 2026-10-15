import { R, type Result } from "@alliance/common/result";
import type { SessionTokensDto } from "@alliance/shared/client";
import { STAGING } from "./releaseTarget";
import {
  ReviewAccountError,
  ReviewSignInUnavailableError,
} from "./reviewSignInErrors";
import { requestTokens } from "./session";

export type RequestedSession = { tokens: SessionTokensDto; review: boolean };

/** Signs in on the binary's deployment, or on staging for an app-store review
 * account once production has checked its password. Clears the guest token
 * once the binary's deployment has merged the guest's work. */
export async function requestSession(params: {
  credentials: {
    email: string;
    password: string;
    guestToken?: string;
  };
  binaryApiUrl: string;
  clearGuestToken: () => Promise<void>;
}): Promise<Result<RequestedSession, Error>> {
  const { credentials } = params;
  const requested = await requestTokens(credentials, params.binaryApiUrl);
  if (requested.ok) {
    if (credentials.guestToken) {
      await params.clearGuestToken();
    }
    return R.success({ tokens: requested.value, review: false });
  }
  if (!(requested.error instanceof ReviewAccountError)) {
    return requested;
  }
  // The guest's work stays with the deployment that issued its token.
  const staged = await requestTokens(
    { email: credentials.email, password: credentials.password },
    STAGING.apiUrl,
  );
  return staged.ok
    ? R.success({ tokens: staged.value, review: true })
    : R.failure(new ReviewSignInUnavailableError(staged.error));
}

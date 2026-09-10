import type { OAuthProvider } from "@alliance/common/oauth";
import type { Result } from "@alliance/common/result";

export type OAuthProfile = {
  provider: OAuthProvider;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export interface OAuthClient {
  authorizationUrl(params: { redirectUri: string; state: string }): string;

  /**
   * `callbackUser` is the `user` form field Apple posts next to the code, and
   * the only place the name ever appears, on the first authorization alone.
   */
  exchangeCode(params: {
    code: string;
    redirectUri: string;
    callbackUser: string | undefined;
  }): Promise<Result<OAuthProfile, Error>>;

  /** The native SDKs hand the app a signed id token with no code to trade. */
  verifyIdentityToken(
    identityToken: string,
  ): Promise<Result<OAuthProfile, Error>>;
}

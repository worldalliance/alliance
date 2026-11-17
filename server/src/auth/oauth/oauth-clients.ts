import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { AppleOAuthClient } from "./apple-oauth.client";
import { GoogleOAuthClient } from "./google-oauth.client";
import type { OAuthClient, OAuthProfile } from "./oauth-client";

@Injectable()
export class OAuthClients {
  private readonly clients: Record<OAuthProvider, OAuthClient>;

  constructor(google: GoogleOAuthClient, apple: AppleOAuthClient) {
    this.clients = {
      [OAuthProvider.Google]: google,
      [OAuthProvider.Apple]: apple,
    };
  }

  get(provider: OAuthProvider): OAuthClient {
    return this.clients[provider];
  }

  async verifyIdentityToken(params: {
    provider: OAuthProvider;
    identityToken: string;
  }): Promise<Result<OAuthProfile, OAuthError>> {
    const profile = await this.get(params.provider).verifyIdentityToken(
      params.identityToken,
    );
    if (!profile.ok) {
      console.error("oauth identity token rejected", profile.error);
      return R.failure(OAuthError.Failed);
    }
    return profile;
  }
}

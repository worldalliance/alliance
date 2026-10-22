import { OAuthProvider } from "@alliance/common/oauth";
import { Injectable } from "@nestjs/common";
import { AppleOAuthClient } from "./apple-oauth.client";
import { GoogleOAuthClient } from "./google-oauth.client";
import type { OAuthClient } from "./oauth-client";

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
}

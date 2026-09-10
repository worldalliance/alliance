import { OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import type { OAuthClient, OAuthProfile } from "./oauth-client";

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
};

const SCOPES = ["openid", "email", "profile"];

@Injectable()
export class GoogleOAuthClient implements OAuthClient {
  private oauth2Client: OAuth2Client | null = null;

  private config(): GoogleConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }
    return { clientId, clientSecret };
  }

  // The library caches Google's signing certs on the client, so a fresh one
  // per call refetches them on every sign-in.
  private client(): OAuth2Client {
    this.oauth2Client ??= new OAuth2Client(this.config());
    return this.oauth2Client;
  }

  authorizationUrl(params: { redirectUri: string; state: string }): string {
    return this.client().generateAuthUrl({
      scope: SCOPES,
      state: params.state,
      redirect_uri: params.redirectUri,
      include_granted_scopes: true,
      prompt: "select_account",
    });
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<Result<OAuthProfile, Error>> {
    const tokens = await R.fromPromise(
      this.client().getToken({
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    );
    if (!tokens.ok) {
      return tokens;
    }
    const idToken = tokens.value.tokens.id_token;
    if (!idToken) {
      return R.failure(new Error("Google returned no id_token"));
    }
    return this.verifyIdentityToken(idToken);
  }

  /**
   * The native SDKs are configured with the web client id as their server
   * client, so a token from either platform carries the same audience.
   */
  async verifyIdentityToken(
    identityToken: string,
  ): Promise<Result<OAuthProfile, Error>> {
    const ticket = await R.fromPromise(
      this.client().verifyIdToken({
        idToken: identityToken,
        audience: this.config().clientId,
      }),
    );
    if (!ticket.ok) {
      return ticket;
    }

    const payload = ticket.value.getPayload();
    if (!payload?.sub || !payload.email) {
      return R.failure(new Error("Google id token carries no email"));
    }

    return R.success({
      provider: OAuthProvider.Google,
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    });
  }
}

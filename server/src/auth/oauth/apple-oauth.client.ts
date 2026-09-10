import { OAuthProvider } from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";
import { z } from "zod";
import type { OAuthClient, OAuthProfile } from "./oauth-client";

type AppleConfig = {
  teamId: string;
  keyId: string;
  /** The web client id; native tokens carry a bundle id instead. */
  servicesId: string;
  bundleIds: string[];
  privateKey: string;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

/** Minted per exchange, so it never needs rotating; Apple's cap is six months. */
const CLIENT_SECRET_LIFETIME = "5m";

const appleClaimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

const callbackUserSchema = z.object({
  name: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
});

const tokenResponseSchema = z.object({ id_token: z.string() });

export function appleCallbackName(
  callbackUser: string | undefined,
): string | null {
  if (!callbackUser) {
    return null;
  }
  const parsed = R.fromThrowable(() =>
    callbackUserSchema.parse(JSON.parse(callbackUser)),
  );
  if (!parsed.ok) {
    return null;
  }
  const name = [parsed.value.name?.firstName, parsed.value.name?.lastName]
    .filter((part) => part)
    .join(" ");
  return name || null;
}

export function appleProfile(
  payload: JWTPayload,
  name: string | null,
): Result<OAuthProfile, Error> {
  const claims = appleClaimsSchema.safeParse(payload);
  if (!claims.success) {
    return R.failure(
      new Error(
        `Apple id token claims did not parse: ${z.prettifyError(claims.error)}`,
      ),
    );
  }
  return R.success({
    provider: OAuthProvider.Apple,
    subject: claims.data.sub,
    email: claims.data.email,
    emailVerified:
      claims.data.email_verified === true ||
      claims.data.email_verified === "true",
    name,
  });
}

@Injectable()
export class AppleOAuthClient implements OAuthClient {
  private config(): AppleConfig {
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const servicesId = process.env.APPLE_SERVICES_ID;
    const bundleIds = process.env.APPLE_BUNDLE_ID?.split(",").filter(Boolean);
    const privateKey = process.env.APPLE_PRIVATE_KEY_BASE64;
    if (!teamId || !keyId || !servicesId || !bundleIds?.length || !privateKey) {
      throw new ServiceUnavailableException("Apple sign-in is not configured");
    }
    return {
      teamId,
      keyId,
      servicesId,
      bundleIds,
      privateKey: Buffer.from(privateKey, "base64").toString(),
    };
  }

  authorizationUrl(params: { redirectUri: string; state: string }): string {
    const url = new URL(`${APPLE_ISSUER}/auth/authorize`);
    url.search = new URLSearchParams({
      response_type: "code",
      // Apple only releases the name and email over a form post.
      response_mode: "form_post",
      scope: "name email",
      client_id: this.config().servicesId,
      redirect_uri: params.redirectUri,
      state: params.state,
    }).toString();
    return url.toString();
  }

  private async clientSecret(config: AppleConfig): Promise<string> {
    const key = await importPKCS8(config.privateKey, "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: config.keyId })
      .setIssuer(config.teamId)
      .setSubject(config.servicesId)
      .setAudience(APPLE_ISSUER)
      .setIssuedAt()
      .setExpirationTime(CLIENT_SECRET_LIFETIME)
      .sign(key);
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
    callbackUser: string | undefined;
  }): Promise<Result<OAuthProfile, Error>> {
    const config = this.config();
    const clientSecret = await R.fromPromise(this.clientSecret(config));
    if (!clientSecret.ok) {
      return clientSecret;
    }
    const posted = await R.fromPromise(
      fetch(`${APPLE_ISSUER}/auth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: params.code,
          redirect_uri: params.redirectUri,
          client_id: config.servicesId,
          client_secret: clientSecret.value,
        }),
      }),
    );
    if (!posted.ok) {
      return posted;
    }
    const response = posted.value;
    if (!response.ok) {
      const detail = await R.fromPromise(response.text());
      return R.failure(
        new Error(
          `Apple token exchange failed: ${R.unwrapOr(detail, response.statusText)}`,
        ),
      );
    }
    const json = await R.fromPromise(response.json());
    if (!json.ok) {
      return json;
    }
    const body = tokenResponseSchema.safeParse(json.value);
    if (!body.success) {
      return R.failure(new Error("Apple returned no id_token"));
    }
    return this.verify({
      identityToken: body.data.id_token,
      audience: config.servicesId,
      name: appleCallbackName(params.callbackUser),
    });
  }

  verifyIdentityToken(
    identityToken: string,
  ): Promise<Result<OAuthProfile, Error>> {
    return this.verify({
      identityToken,
      audience: this.config().bundleIds,
      name: null,
    });
  }

  private async verify(params: {
    identityToken: string;
    audience: string | string[];
    name: string | null;
  }): Promise<Result<OAuthProfile, Error>> {
    const verified = await R.fromPromise(
      jwtVerify(params.identityToken, APPLE_JWKS, {
        issuer: APPLE_ISSUER,
        audience: params.audience,
      }),
    );
    if (!verified.ok) {
      return verified;
    }
    return appleProfile(verified.value.payload, params.name);
  }
}

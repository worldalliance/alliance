import type { OAuthIntent, OAuthProvider } from "@alliance/common/oauth";
import type { Request as ExpressRequest } from "express";
import { DEFAULT_TIME_ZONE } from "src/user/entities/user.entity";
import { mintProof, OAuthAuthService, OAuthOrigin } from "./oauth-auth.service";
import type { OAuthClient } from "./oauth-client";
import { mobileOAuthRedirectUri, mobileReturnUrl } from "./oauth-urls";
import { MobileOAuthBrowserSessionDto } from "./oauth.dto";

export async function beginMobileBrowserSession(params: {
  oauth: OAuthAuthService;
  client: OAuthClient;
  provider: OAuthProvider;
  req: ExpressRequest;
  intent: OAuthIntent;
  userId?: number;
}): Promise<MobileOAuthBrowserSessionDto> {
  const { provider, req } = params;
  const { proof, proofHash } = mintProof();
  const redirectUri = mobileOAuthRedirectUri({ req, provider });
  const returnTo = mobileReturnUrl();
  const state = await params.oauth.signState({
    provider,
    intent: params.intent,
    origin: OAuthOrigin.Mobile,
    redirectUri,
    returnTo,
    timeZone: DEFAULT_TIME_ZONE,
    proofHash,
    userId: params.userId,
  });
  return new MobileOAuthBrowserSessionDto({
    url: params.client.authorizationUrl({ redirectUri, state }),
    proof,
    returnTo,
  });
}

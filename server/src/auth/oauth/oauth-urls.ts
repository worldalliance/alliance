import { currentNodeEnv, isDeployed } from "@alliance/common/node-env";
import {
  MOBILE_OAUTH_ERROR_PARAM,
  MOBILE_OAUTH_HANDOFF_PARAM,
  MOBILE_OAUTH_RETURN_PATH,
  MOBILE_OAUTH_RETURN_URL,
  oauthErrorParam,
  oauthOutcomeParam,
  type OAuthError,
  type OAuthOutcome,
  type OAuthProvider,
} from "@alliance/common/oauth";
import type { Result } from "@alliance/common/result";
import { BadRequestException } from "@nestjs/common";
import { isAllowedOrigin } from "../allowed-origins";

type OriginRequest = {
  protocol: string;
  get(header: "host"): string | undefined;
};

function deployed(): boolean {
  const env = currentNodeEnv();
  return env.ok && isDeployed(env.value);
}

function requestOrigin(req: OriginRequest): string {
  return `${req.protocol}://${req.get("host")}`;
}

/**
 * The provider matches this against its registered list, and the callback
 * sets the session cookies on whatever origin it runs on, so it has to be the
 * origin the browser came from rather than one canonical host. Deployed, that
 * is the vetted returnTo, under the /api prefix nginx serves the API on.
 */
export function callbackUri(params: {
  req: OriginRequest;
  path: string;
  returnTo: URL;
}): string {
  if (!deployed()) {
    return `${requestOrigin(params.req)}${params.path}`;
  }
  return `${params.returnTo.origin}/api${params.path}`;
}

export function oauthRedirectUri(params: {
  req: OriginRequest;
  provider: OAuthProvider;
  returnTo: URL;
}): string {
  return callbackUri({
    req: params.req,
    path: `/auth/${params.provider}/callback`,
    returnTo: params.returnTo,
  });
}

/**
 * The caller never picks this. Whoever starts a flow holds its proof, so a
 * return link another app can claim hands that app the member's session.
 * Deployed, it is the https path, which Android verifies against the
 * production package's signing certificate. When the browser keeps the
 * redirect, the page there opens whichever app has the package name,
 * certificate unchecked. A local server answers with the scheme, which a dev
 * build can claim.
 */
export function mobileReturnUrl(): string {
  if (!deployed()) {
    return MOBILE_OAUTH_RETURN_URL;
  }
  return `${appUrl().origin}${MOBILE_OAUTH_RETURN_PATH}`;
}

/**
 * A mobile-started flow has no web origin to come back to, so its callback
 * runs on the web app's, which each provider already has registered.
 */
export function mobileOAuthRedirectUri(params: {
  req: OriginRequest;
  provider: OAuthProvider;
}): string {
  return oauthRedirectUri({
    ...params,
    returnTo: deployed() ? appUrl() : new URL(requestOrigin(params.req)),
  });
}

function appUrl(): URL {
  if (!process.env.APP_URL) {
    throw new Error("APP_URL is not set");
  }
  return new URL(process.env.APP_URL);
}

export function mobileReturnUrlWith(params: {
  returnTo: string;
  handoff: Result<string, OAuthError>;
}): string {
  const url = new URL(params.returnTo);
  if (params.handoff.ok) {
    url.searchParams.set(MOBILE_OAUTH_HANDOFF_PARAM, params.handoff.value);
  } else {
    url.searchParams.set(MOBILE_OAUTH_ERROR_PARAM, params.handoff.error);
  }
  return url.toString();
}

export function fallbackAppUrl(req: OriginRequest, path: string): string {
  return `${process.env.APP_URL ?? requestOrigin(req)}${path}`;
}

export function fallbackLoginUrl(req: OriginRequest): string {
  return fallbackAppUrl(req, "/login");
}

/**
 * The caller is sent wherever this resolves to after the provider, so an
 * unvetted destination here is an open redirect. Nothing off the request may
 * widen the set: the Host header is the caller's to choose.
 */
export function resolveReturnTo(returnTo: string): URL {
  let url: URL;
  try {
    url = new URL(returnTo);
  } catch {
    throw new BadRequestException("returnTo must be an absolute URL");
  }

  if (!isAllowedOrigin(url.origin)) {
    throw new BadRequestException(`returnTo ${url.origin} is not allowed`);
  }

  return url;
}

export function returnUrlWithOutcome(params: {
  returnTo: string;
  provider: OAuthProvider;
  outcome: OAuthOutcome;
}): string {
  const url = new URL(params.returnTo);
  url.searchParams.set(oauthOutcomeParam(params.provider), params.outcome);
  return url.toString();
}

export function returnUrlWithError(params: {
  returnTo: string;
  provider: OAuthProvider;
  error: OAuthError;
}): string {
  const url = new URL(params.returnTo);
  url.searchParams.set(oauthErrorParam(params.provider), params.error);
  return url.toString();
}

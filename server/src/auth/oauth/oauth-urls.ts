import { currentNodeEnv, isDeployed } from "@alliance/common/node-env";
import {
  MOBILE_OAUTH_RETURN_URL,
  OAUTH_HANDOFF_PARAM,
  oauthErrorParam,
  oauthOutcomeParam,
  type OAuthError,
  type OAuthOutcome,
  type OAuthProvider,
} from "@alliance/common/oauth";
import { BadRequestException } from "@nestjs/common";
import { socketCorsOrigins } from "src/utils/cors-origins";

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
 * origin the member came from rather than one canonical host. Deployed, that is
 * the vetted returnTo, under the /api prefix nginx serves the API on. A native
 * returnTo takes no cookies, so the flow can finish on the canonical app.
 */
export function oauthRedirectUri(params: {
  req: OriginRequest;
  provider: OAuthProvider;
  returnTo: URL;
}): string {
  const path = `/auth/${params.provider}/callback`;
  if (!deployed()) {
    return `${requestOrigin(params.req)}${path}`;
  }

  const origin = isNativeReturnTo(params.returnTo)
    ? appOrigin()
    : params.returnTo.origin;
  return `${origin}/api${path}`;
}

function appOrigin(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is unset, so sign-in has no home origin");
  }
  return new URL(appUrl).origin;
}

/**
 * nginx serves the two public sites under `www.` as well, and the admin hosts
 * have no such alias, which is why only these two grow the variant. Staging
 * grows one no provider has a registration for, but nothing serves that host.
 */
function allowedOrigins(): (string | RegExp)[] {
  const configured = socketCorsOrigins({
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.APP_URL,
    altAppUrl: process.env.ALT_APP_URL,
    adminUrl: process.env.ADMIN_URL,
    altAdminUrl: process.env.ALT_ADMIN_URL,
  });

  const www = [process.env.APP_URL, process.env.ALT_APP_URL]
    .filter((url): url is string => !!url)
    .map((url) => new URL(url))
    .map((url) => `${url.protocol}//www.${url.host}`);

  return [...configured, ...www];
}

export function isNativeReturnTo(returnTo: URL): boolean {
  return returnTo.toString() === MOBILE_OAUTH_RETURN_URL;
}

export function fallbackLoginUrl(req: OriginRequest): string {
  return `${process.env.APP_URL ?? requestOrigin(req)}/login`;
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

  const permitted =
    isNativeReturnTo(url) ||
    allowedOrigins().some((allowed) =>
      typeof allowed === "string"
        ? allowed === url.origin
        : allowed.test(url.origin),
    );

  if (!permitted) {
    throw new BadRequestException(`returnTo ${url.origin} is not allowed`);
  }

  return url;
}

export function returnUrlWithOutcome(params: {
  returnTo: string;
  provider: OAuthProvider;
  outcome: OAuthOutcome;
  handoff?: string;
}): string {
  const url = new URL(params.returnTo);
  url.searchParams.set(oauthOutcomeParam(params.provider), params.outcome);
  if (params.handoff) {
    url.searchParams.set(OAUTH_HANDOFF_PARAM, params.handoff);
  }
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

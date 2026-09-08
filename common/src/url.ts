import isURL, { type IsURLOptions } from "validator/lib/isURL";

export const HTTP_URL_VALIDATOR_OPTIONS: IsURLOptions = {
  require_protocol: true,
  protocols: ["http", "https"],
};

export const isValidHttpUrl = (value: string): boolean =>
  isURL(value.trim(), HTTP_URL_VALIDATOR_OPTIONS);

/**
 * Prepends `https://` to values without an http(s) scheme, so user-typed
 * bare domains ("example.com") become absolute URLs instead of being
 * treated as relative paths (or rejected by `isValidHttpUrl`).
 */
export const ensureHttpProtocol = (url: string): string => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
};

/**
 * Whether `hostname` is `domain` or a subdomain of it — so "www.linkedin.com"
 * matches "linkedin.com" but "linkedin.com.evil.com" doesn't.
 */
export const hostnameMatchesDomain = (
  hostname: string,
  domain: string,
): boolean => {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
};

/**
 * Whether `url`'s host is `domain` or a subdomain of it — so
 * "www.linkedin.com/in/x" matches "linkedin.com" but
 * "evil.com/linkedin.com" and "linkedin.com.evil.com" don't. Tolerates
 * scheme-less input; false for unparseable values.
 */
export function urlMatchesDomain(url: string, domain: string): boolean {
  try {
    const { hostname } = new URL(ensureHttpProtocol(url.trim()));
    return hostnameMatchesDomain(hostname, domain);
  } catch {
    return false;
  }
}

export function appendQueryParam(
  url: string,
  paramName: string,
  value: string,
): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.append(paramName, value);
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(paramName)}=${encodeURIComponent(value)}`;
  }
}

/** The site is served on both domains while the move to the new one finishes. */
export const ALLIANCE_LEGACY_DOMAIN = "worldalliance.org";
export const ALLIANCE_DOMAIN = "thealliance.org";

/**
 * The hosts the web app answers on, per deploy/nginx/alliance.conf. A host
 * outside this list — `admin.`, or one added later — is not the web app.
 */
const ALLIANCE_APP_SUBDOMAINS = ["", "www.", "staging.", "www.staging."];

export const isAllianceAppHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return [ALLIANCE_LEGACY_DOMAIN, ALLIANCE_DOMAIN].some((domain) =>
    ALLIANCE_APP_SUBDOMAINS.some((prefix) => host === `${prefix}${domain}`),
  );
};

/**
 * An authored link, aimed at the domain the reader is already on: a link to one
 * of the web app's own hosts comes back as a bare path, for the browser to
 * resolve against the current one. Anything else is returned as authored.
 */
export const siteHref = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !isAllianceAppHostname(parsed.hostname)
  ) {
    return url;
  }
  const path = parsed.pathname + parsed.search + parsed.hash;
  // A path opening with `//` reads as protocol-relative: the browser would
  // resolve it against the host that follows, not the current one.
  return path.startsWith("//") ? url : path;
};

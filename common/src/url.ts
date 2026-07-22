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
 * Whether `url`'s host is `domain` or a subdomain of it — so
 * "www.linkedin.com/in/x" matches "linkedin.com" but
 * "evil.com/linkedin.com" and "linkedin.com.evil.com" don't. Tolerates
 * scheme-less input; false for unparseable values.
 */
export function urlMatchesDomain(url: string, domain: string): boolean {
  try {
    const { hostname } = new URL(ensureHttpProtocol(url.trim()));
    return hostname === domain || hostname.endsWith(`.${domain}`);
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

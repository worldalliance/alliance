/**
 * Protocols authored content may embed or link to. Same list react-markdown's
 * `defaultUrlTransform` allows; `sharedweb/lib/markdownUrl.test.ts` pins the
 * two together, since the web renderer relies on this instead of the built-in.
 */
const SAFE_PROTOCOLS = [
  "http",
  "https",
  "irc",
  "ircs",
  "mailto",
  "xmpp",
] as const;

/**
 * Spread from {@link SAFE_PROTOCOLS} so the two can't drift: handing `tel:` to
 * the OS is safe, putting it in a document react-markdown renders is not part
 * of the parity contract.
 */
const SAFE_LINK_PROTOCOLS = [...SAFE_PROTOCOLS, "tel", "sms"] as const;

/**
 * The scheme when `url` carries one, `null` when it's a relative path or an
 * in-page anchor. A bare `:` yields `""`, which no allowlist accepts.
 */
export function urlProtocol(url: string): string | null {
  const colon = url.indexOf(":");
  if (colon === -1) {
    return null;
  }

  // A colon past the first `/`, `?` or `#` sits in the path or query, so what
  // precedes it is not a protocol.
  for (const char of ["/", "?", "#"]) {
    const index = url.indexOf(char);
    if (index !== -1 && colon > index) {
      return null;
    }
  }

  return url.slice(0, colon);
}

const allows = (protocols: readonly string[], url: string): boolean => {
  const protocol = urlProtocol(url);
  return protocol === null || protocols.includes(protocol.toLowerCase());
};

/**
 * Whether a URL from authored content can be embedded in a document. Relative
 * paths and in-page anchors are safe; a `javascript:` URL or an unknown app
 * scheme is not.
 */
export function isSafeUrl(url: string): boolean {
  return allows(SAFE_PROTOCOLS, url);
}

/**
 * Whether a URL from authored content can be handed to `Linking.openURL`.
 * Everything {@link isSafeUrl} allows, plus the schemes that address the
 * device rather than another app.
 */
export function isSafeLinkUrl(url: string): boolean {
  return allows(SAFE_LINK_PROTOCOLS, url);
}

/** `url` when {@link isSafeUrl}, `""` otherwise, matching what `urlTransform` expects. */
export const safeUrl = (url: string): string => (isSafeUrl(url) ? url : "");

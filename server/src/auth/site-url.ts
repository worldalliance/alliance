/**
 * The web app URL serving `host`, so a redirect lands on the host whose
 * cookies were just set. Matches only configured URLs, never the raw header.
 */
export function siteUrlForHost(params: {
  host: string | undefined;
  appUrl: string;
  altAppUrl?: string;
}): string {
  const host = params.host?.toLowerCase();
  const alt = params.altAppUrl;
  if (alt && host === new URL(alt).host) {
    return alt;
  }
  return params.appUrl;
}

import { isLegacyAllianceHost } from "@alliance/common/url";

/**
 * The paths nginx's `$static_page_redirect_host` map in
 * `deploy/nginx/alliance.conf` sends from the legacy domain to the new
 * domain on a document load. The session and guest cookies are host-only, so
 * a visitor landing there that way loses them.
 */
export const NEW_DOMAIN_PAGE_PATTERNS = [
  "^/(people|guide|foundation|governance|description|faq|invite|partner|outreach-partner|privacypolicy|childsafety|terms|utensilinitiative|restaurantguide|memberquotes)/?$",
  "^/(progress|projects)(/|$)",
];

/** nginx's invite location. */
export const INVITE_PAGE_PATTERN = "^/(signup)?$";

const newDomainPages = NEW_DOMAIN_PAGE_PATTERNS.map((p) => new RegExp(p, "i"));
const invitePage = new RegExp(INVITE_PAGE_PATTERN);

/**
 * Whether nginx redirects a document load of this URL to the new domain
 * before the environment cuts over. Once it has, nginx redirects every page
 * load on a legacy host. Exact for the URLs the app builds; nginx also decodes
 * the path, merges slashes and matches `ref` case-insensitively.
 */
export const movesToNewDomain = (request: {
  hostname: string;
  pathname: string;
  search: string;
}) =>
  isLegacyAllianceHost(request.hostname) &&
  (newDomainPages.some((pattern) => pattern.test(request.pathname)) ||
    (invitePage.test(request.pathname) &&
      !!new URLSearchParams(request.search).get("ref")));

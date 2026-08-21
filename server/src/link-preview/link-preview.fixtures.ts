import { Readable } from "node:stream";
import { SafeHttpResponse, SafeHttpTransport } from "src/utils/safe-http";

/**
 * Shared fixtures for the link-preview unit and e2e specs: a canonical
 * OpenGraph page with a declared favicon, and a fake transport that stands
 * in for DNS + HTTP so the real fetch pipeline runs with no network.
 */

export const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export const PAGE_HTML = `<html><head>
  <title>Fallback Title</title>
  <meta property="og:title" content="Example Title">
  <meta property="og:description" content="Example description.">
  <meta property="og:site_name" content="Example Site">
  <link rel="icon" href="/fav.png">
</head><body></body></html>`;

export function response(
  body: string | Buffer,
  headers: Record<string, string> = {},
  status = 200,
): SafeHttpResponse {
  return {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
    body: Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(body)]),
  };
}

/**
 * `routes` maps an incoming URL to its response; `lookups` maps hostnames
 * to the address DNS "resolves" (default: a public address). `requested`
 * records every URL that reached the HTTP layer — an SSRF-blocked hop must
 * never appear in it.
 */
export function makeTransport(
  routes: (url: URL) => SafeHttpResponse | Promise<SafeHttpResponse>,
  lookups: Record<string, string> = {},
): { transport: SafeHttpTransport; requested: string[] } {
  const requested: string[] = [];
  const transport: SafeHttpTransport = {
    lookup: async (hostname) => [
      { address: lookups[hostname] ?? "93.184.216.34", family: 4 },
    ],
    request: async (url) => {
      requested.push(url.href);
      return routes(url);
    },
  };
  return { transport, requested };
}

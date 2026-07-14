import { R, type Result } from '@alliance/common/result';
import ipaddr from 'ipaddr.js';
import { lookup as dnsLookup } from 'node:dns/promises';
import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type RequestOptions,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { pipeline, type Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip } from 'node:zlib';

/**
 * SSRF-guarded outbound HTTP: fetch a caller-supplied URL without letting it
 * reach private networks, loopback, cloud metadata, or non-default ports.
 * DNS is resolved up front and the connection is pinned to the resolved
 * address (Host and TLS SNI preserved), so a rebinding host can't pass the
 * check with one address and serve the request from another. Redirects are
 * re-validated hop by hop.
 */

const FETCH_TIMEOUT_MS = 5_000;
// A hostname can resolve to arbitrarily many addresses; trying each costs up
// to FETCH_TIMEOUT_MS, so only the first few get a connection attempt.
const MAX_ADDRESSES_TRIED = 2;
const MAX_REDIRECTS = 3;
export const HTML_ACCEPT = 'text/html,application/xhtml+xml';

// Honest bot UA — sites like Wikipedia 403 spoofed crawler tokens
// (e.g. a fake facebookexternalhit), so don't add any.
const USER_AGENT =
  'Mozilla/5.0 (compatible; AllianceLinkPreview/1.0; +https://worldalliance.org)';

/**
 * The fetcher's only two touchpoints with the network, injectable so tests
 * can exercise the full pipeline (redirects, SSRF re-checks, caps) against a
 * fake. `lookup` is DNS resolution; `request` performs one HTTP GET against
 * an already-resolved address.
 */
export type SafeHttpTransport = {
  lookup: (
    hostname: string,
  ) => Promise<Array<{ address: string; family: number }>>;
  request: (
    url: URL,
    target: ResolvedAddress,
    options: FetchOptions,
  ) => Promise<SafeHttpResponse>;
};

export const defaultSafeHttpTransport: SafeHttpTransport = {
  lookup: (hostname) => dnsLookup(hostname, { all: true }),
  request: (url, target, options) =>
    getWithResolvedAddress(url, target, options),
};

export type FetchedResponse = {
  response: SafeHttpResponse;
  finalUrl: URL;
};

/**
 * `signal` is the caller's overall deadline; it bounds the whole chain of
 * hops and address attempts, while {@link FETCH_TIMEOUT_MS} separately bounds
 * each single attempt.
 */
export type FetchOptions = {
  signal: AbortSignal;
  accept: string;
};

/**
 * Follows up to {@link MAX_REDIRECTS} redirects, re-running the SSRF checks
 * on every hop, and returns the final non-redirect 2xx response. Failure
 * carries the HTTP-level reason (bad status, unusable redirect) for the
 * caller's debug log; DNS/SSRF/transport errors still reject, landing in
 * the same catch as every other exceptional fetch failure.
 */
export async function fetchWithRedirects(
  url: URL,
  transport: SafeHttpTransport,
  options: FetchOptions,
): Promise<Result<FetchedResponse, string>> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await getWithSafeLookup(current, transport, options);

    if (isRedirect(response.status)) {
      const location = getHeader(response.headers, 'location');
      response.body.destroy();
      if (!location) {
        return R.failure(
          `redirect (${response.status}) without a location header`,
        );
      }
      const next = parseHttpUrl(location, current);
      if (!next.ok) {
        return R.failure(
          `redirect to unfetchable location (${next.error}): ${location}`,
        );
      }
      current = next.value;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.destroy();
      return R.failure(`HTTP ${response.status}`);
    }

    return R.success({ response, finalUrl: current });
  }

  return R.failure(`more than ${MAX_REDIRECTS} redirects`);
}

/** Which rule makes a caller-supplied URL one we will never fetch. */
export enum UnfetchableUrl {
  Malformed = 'malformed',
  UnsupportedScheme = 'unsupported-scheme',
  ExplicitPort = 'explicit-port',
}

/**
 * Only default-port URLs are fetchable: an explicit port would let a
 * caller-supplied URL aim GETs at arbitrary services on public hosts (port
 * scanning/reflection). Applies to redirect targets too via `base`. The
 * failure names the rejecting rule — "not a URL" and "valid URL we refuse
 * on principle" deserve different 400s and different debug lines. Callers
 * that don't care can `R.toNullable` it.
 */
export function parseHttpUrl(
  raw: string,
  base?: URL,
): Result<URL, UnfetchableUrl> {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return R.failure(UnfetchableUrl.Malformed);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return R.failure(UnfetchableUrl.UnsupportedScheme);
  }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return R.failure(UnfetchableUrl.ExplicitPort);
  }
  return R.success(url);
}

function isRedirect(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

export type SafeHttpResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Readable;
};

async function getWithSafeLookup(
  url: URL,
  transport: SafeHttpTransport,
  options: FetchOptions,
): Promise<SafeHttpResponse> {
  const addresses = await resolvePublicAddresses(url, transport.lookup);
  let lastError: unknown;

  for (const address of addresses.slice(0, MAX_ADDRESSES_TRIED)) {
    try {
      return await transport.request(url, address, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to fetch URL: ${url.href}`);
}

function getWithResolvedAddress(
  url: URL,
  target: ResolvedAddress,
  options: FetchOptions,
): Promise<SafeHttpResponse> {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  // Whichever fires first aborts the attempt — including a response body
  // that is still streaming when the deadline hits.
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(FETCH_TIMEOUT_MS),
  ]);

  return new Promise((resolve, reject) => {
    const req = request(
      buildRequestOptions(url, target, { signal, accept: options.accept }),
      (res) => {
        // Keep a listener attached for late response errors so a best-effort
        // fetch never brings down the server process.
        res.once('error', () => {});
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res,
        });
      },
    );

    req.once('error', reject);
    req.end();
  });
}

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type SafeHttpRequestOptions = RequestOptions & {
  servername?: string;
};

export async function resolvePublicAddresses(
  url: URL,
  lookup: SafeHttpTransport['lookup'] = defaultSafeHttpTransport.lookup,
): Promise<ResolvedAddress[]> {
  const hostname = normalizeHostname(url.hostname);
  const literalFamily = isIP(hostname);

  if (literalFamily === 4 || literalFamily === 6) {
    if (isPrivateAddress(hostname)) {
      throw new Error(`Blocked non-public address: ${hostname}`);
    }
    return [{ address: hostname, family: literalFamily }];
  }

  if (isLocalHostname(hostname)) {
    throw new Error('Blocked localhost');
  }

  const addresses = await lookup(hostname);
  const blocked = addresses.find(({ address }) => isPrivateAddress(address));
  if (blocked) {
    throw new Error(
      `Blocked host resolving to non-public address: ${hostname}`,
    );
  }

  if (addresses.length === 0) {
    throw new Error(`No DNS addresses for host: ${hostname}`);
  }

  return addresses
    .map(({ address, family }) => {
      const normalizedFamily: 4 | 6 = family === 6 ? 6 : 4;
      return { address, family: normalizedFamily };
    })
    .sort((a, b) => a.family - b.family);
}

export function buildRequestOptions(
  url: URL,
  target: ResolvedAddress,
  extras: { signal?: AbortSignal; accept?: string } = {},
): SafeHttpRequestOptions {
  const hostname = normalizeHostname(url.hostname);
  return {
    agent: false,
    family: target.family,
    headers: {
      host: url.host,
      'user-agent': USER_AGENT,
      accept: extras.accept ?? HTML_ACCEPT,
      // Advertised so decodedBodyStream's supported encodings are exercised
      // by compliant servers too, not just the ones that compress unasked.
      'accept-encoding': 'gzip, br',
    },
    hostname: target.address,
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    port: url.port ? Number(url.port) : defaultPortForProtocol(url.protocol),
    protocol: url.protocol,
    servername: isIP(hostname) ? undefined : hostname,
    signal: extras.signal,
  };
}

function defaultPortForProtocol(protocol: string): number {
  switch (protocol) {
    case 'http:':
      return 80;
    case 'https:':
      return 443;
    default:
      throw new Error(`unsupported protocol: ${protocol}`);
  }
}

export function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

export function getHeader(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

// IPv6 ranges ipaddr.js reports as `unicast` but that we still refuse to
// fetch: deprecated site-local (RFC 3879 — may address an internal host) and
// the RFC 6666 discard-only block.
const EXTRA_BLOCKED_V6: ReadonlyArray<[ipaddr.IPv6, number]> = [
  [ipaddr.parse('fec0::') as ipaddr.IPv6, 10],
  [ipaddr.parse('100::') as ipaddr.IPv6, 64],
];

/**
 * True for any address we must not fetch: private, loopback, link-local
 * (incl. cloud metadata at 169.254.169.254), unique-local, CGNAT, and every
 * reserved/tunnel range. We do this by *allow-listing* `unicast` and blocking
 * everything else, which fails closed on exotic ranges that embed an IPv4
 * target (IPv4-mapped `::ffff:0:0/96`, NAT64, 6to4, Teredo) — the classic SSRF
 * bypasses. IPv4-mapped addresses are unwrapped first so the v4 ranges apply
 * (the WHATWG URL parser canonicalizes `::ffff:169.254.169.254` to
 * `::ffff:a9fe:a9fe`, which a textual match would miss).
 */
export function isPrivateAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return true; // unparseable — fail closed
  }
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      parsed = v6.toIPv4Address();
    }
  }
  if (parsed.range() !== 'unicast') {
    return true;
  }
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    return EXTRA_BLOCKED_V6.some(([net, bits]) => v6.match(net, bits));
  }
  return false;
}

/**
 * Response body decoded per its Content-Encoding header. We advertise gzip
 * and brotli, but some servers/CDNs compress regardless of what was asked
 * for — without this a caller's parser would chew on binary garbage.
 * Unsupported encodings throw (after tearing down the response) so the
 * fetch fails cleanly instead.
 */
export function decodedBodyStream(
  body: Readable,
  contentEncoding: string | null,
): Readable {
  const encoding = contentEncoding?.trim().toLowerCase() ?? 'identity';
  if (encoding === '' || encoding === 'identity') {
    return body;
  }
  if (encoding === 'gzip' || encoding === 'x-gzip' || encoding === 'br') {
    const decompress =
      encoding === 'br' ? createBrotliDecompress() : createGunzip();
    // pipeline (not .pipe) so teardown propagates both ways: when
    // readBodyCapped destroys the decompress stream at the byte cap, the
    // underlying socket must stop downloading too.
    pipeline(body, decompress, () => {});
    return decompress;
  }
  body.destroy();
  throw new Error(`Unsupported content-encoding: ${encoding}`);
}

export async function readBodyCapped(
  body: Readable,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of body) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    chunks.push(value);
    total += value.byteLength;
    if (total > maxBytes) {
      body.destroy();
      break;
    }
  }

  return Buffer.concat(chunks).subarray(0, maxBytes);
}

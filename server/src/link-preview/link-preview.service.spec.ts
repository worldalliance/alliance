import { R } from '@alliance/common/result';
import * as cheerio from 'cheerio';
import { gzipSync } from 'node:zlib';
import { UnfetchableUrl } from 'src/utils/safe-http';
import {
  makeTransport,
  PAGE_HTML,
  PNG_BYTES,
  response,
} from './link-preview.fixtures';
import {
  charsetFromContentType,
  decodeHtmlBody,
  extractFaviconUrls,
  isSvgDocument,
  LinkPreviewService,
  PreviewUnavailable,
  sniffImageMime,
} from './link-preview.service';

describe('charsetFromContentType', () => {
  it('extracts the charset parameter, ignoring case and quotes', () => {
    expect(charsetFromContentType('text/html; charset=UTF-8')).toBe('utf-8');
    expect(charsetFromContentType('text/html; charset="windows-1251"')).toBe(
      'windows-1251',
    );
    expect(charsetFromContentType('text/html;charset=Shift_JIS')).toBe(
      'shift_jis',
    );
  });

  it('returns null when no charset is declared', () => {
    expect(charsetFromContentType('text/html')).toBe(null);
    expect(charsetFromContentType(null)).toBe(null);
  });
});

describe('decodeHtmlBody', () => {
  // "Привет" in windows-1251
  const win1251 = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);

  it('decodes using the header-declared charset', () => {
    expect(decodeHtmlBody(win1251, 'text/html; charset=windows-1251')).toBe(
      'Привет',
    );
  });

  // Legacy non-UTF-8 pages usually declare their charset only in the markup;
  // the WHATWG prescan of the first 1024 bytes must pick it up.
  it('sniffs <meta charset> when the header declares none', () => {
    const html = Buffer.concat([
      Buffer.from('<html><head><meta charset="windows-1251"><title>'),
      win1251,
      Buffer.from('</title></head></html>'),
    ]);
    expect(decodeHtmlBody(html, 'text/html')).toContain('Привет');
    expect(decodeHtmlBody(html, null)).toContain('Привет');
  });

  it('prefers the header charset over <meta charset>', () => {
    // The meta lies (claims UTF-8); the transport-layer label wins per spec.
    const html = Buffer.concat([
      Buffer.from('<meta charset="utf-8">'),
      win1251,
    ]);
    expect(decodeHtmlBody(html, 'text/html; charset=windows-1251')).toContain(
      'Привет',
    );
  });

  it('prefers a BOM over everything else', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const html = Buffer.concat([bom, Buffer.from('héllo', 'utf-8')]);
    expect(decodeHtmlBody(html, 'text/html; charset=windows-1251')).toBe(
      'héllo',
    );
  });

  it('falls back to UTF-8 for missing or unknown charsets', () => {
    const utf8 = Buffer.from('héllo', 'utf-8');
    expect(decodeHtmlBody(utf8, 'text/html')).toBe('héllo');
    expect(decodeHtmlBody(utf8, 'text/html; charset=not-a-charset')).toBe(
      'héllo',
    );
    expect(decodeHtmlBody(utf8, null)).toBe('héllo');
  });
});

describe('extractFaviconUrls', () => {
  const base = new URL('https://example.com/blog/post');
  // The real pipeline parses once and shares the DOM; here each case
  // parses its own snippet.
  const extract = (html: string, baseUrl: URL) =>
    extractFaviconUrls(cheerio.load(html), baseUrl).map((url) => url.href);

  it('resolves a relative rel="icon" href against the final page URL', () => {
    const html =
      '<html><head><link rel="icon" href="/static/fav.png"></head></html>';
    expect(extract(html, base)).toEqual([
      'https://example.com/static/fav.png',
      'https://example.com/favicon.ico',
    ]);
  });

  it('accepts absolute and legacy rel="shortcut icon" hrefs', () => {
    const html =
      '<link rel="shortcut icon" href="https://cdn.example.net/fav.ico">';
    expect(extract(html, base)).toEqual([
      'https://cdn.example.net/fav.ico',
      'https://example.com/favicon.ico',
    ]);
  });

  it('orders rel="icon" before apple-touch-icon', () => {
    const html = `
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" href="/fav.ico">`;
    expect(extract(html, base)).toEqual([
      'https://example.com/fav.ico',
      'https://example.com/touch.png',
      'https://example.com/favicon.ico',
    ]);
  });

  it('falls back to apple-touch-icon, then /favicon.ico', () => {
    expect(
      extract('<link rel="apple-touch-icon" href="/t.png">', base),
    ).toEqual(['https://example.com/t.png', 'https://example.com/favicon.ico']);
    expect(extract('<html></html>', base)).toEqual([
      'https://example.com/favicon.ico',
    ]);
  });

  // SVG icons are usable candidates — the fetch path rasterizes them to
  // PNG — so they keep their declared position in the candidate order.
  it('keeps declared SVG icons as candidates', () => {
    const html = `
      <link rel="icon" type="image/svg+xml" href="/fav.svg">
      <link rel="alternate icon" href="/fav.png">`;
    expect(extract(html, base)).toEqual([
      'https://example.com/fav.svg',
      'https://example.com/fav.png',
      'https://example.com/favicon.ico',
    ]);
  });

  // Declared icons go through parseHttpUrl like any fetched URL, so the
  // scheme/port rules apply; unusable candidates fall through to the default.
  it('skips candidates the fetcher would refuse', () => {
    const dataUri = '<link rel="icon" href="data:image/png;base64,iVBORw0=">';
    expect(extract(dataUri, base)).toEqual(['https://example.com/favicon.ico']);
    const oddPort = '<link rel="icon" href="https://example.com:8443/f.ico">';
    expect(extract(oddPort, base)).toEqual(['https://example.com/favicon.ico']);
  });

  // Every candidate can cost a fetch within the page's shared deadline, so
  // the declared list is capped and duplicates collapse.
  it('caps declared candidates and dedupes repeated hrefs', () => {
    const manyIcons = `
      <link rel="icon" href="/a.png">
      <link rel="icon" href="/b.png">
      <link rel="icon" href="/c.png">`;
    expect(extract(manyIcons, base)).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.png',
      'https://example.com/favicon.ico',
    ]);

    const duplicated = `
      <link rel="icon" href="/favicon.ico">
      <link rel="shortcut icon" href="/favicon.ico">`;
    expect(extract(duplicated, base)).toEqual([
      'https://example.com/favicon.ico',
    ]);
  });
});

// The favicon bytes are attacker-controlled and end up in a data: URI handed
// to browsers, so only allow-listed raster magic bytes may pass — never the
// declared Content-Type, and never SVG (it can carry scripts).
describe('sniffImageMime', () => {
  const cases: ReadonlyArray<[string, Buffer, string]> = [
    ['ICO', Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]), 'image/x-icon'],
    [
      'PNG',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    ],
    ['GIF', Buffer.from('GIF89a'), 'image/gif'],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [
      'WebP',
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WEBP'),
      ]),
      'image/webp',
    ],
  ];

  for (const [label, bytes, mime] of cases) {
    it(`detects ${label}`, () => {
      expect(sniffImageMime(bytes)).toBe(mime);
    });
  }

  const rejected: ReadonlyArray<[string, Buffer]> = [
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['HTML error page', Buffer.from('<!doctype html><html>404</html>')],
    ['CUR (ICO sibling)', Buffer.from([0x00, 0x00, 0x02, 0x00])],
    ['empty', Buffer.alloc(0)],
    ['truncated magic', Buffer.from([0x89, 0x50])],
  ];

  for (const [label, bytes] of rejected) {
    it(`rejects ${label}`, () => {
      expect(sniffImageMime(bytes)).toBe(null);
    });
  }
});

// Gate to the rasterization path: only documents whose root element is <svg
// reach sharp. Doctypes with an internal subset are refused outright — the
// subset is where entity definitions (billion laughs) live.
describe('isSvgDocument', () => {
  const accepted: ReadonlyArray<[string, string]> = [
    ['bare svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ['self-closing svg', '<svg/>'],
    [
      'full prolog (BOM, XML declaration, comment, doctype)',
      '\uFEFF <?xml version="1.0"?> <!-- logo --> ' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
        '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg></svg>',
    ],
  ];

  for (const [label, text] of accepted) {
    it(`accepts ${label}`, () => {
      expect(isSvgDocument(Buffer.from(text))).toBe(true);
    });
  }

  const rejected: ReadonlyArray<[string, string]> = [
    ['HTML', '<!doctype html><html><svg></svg></html>'],
    [
      'doctype with entity subset (billion laughs)',
      '<!DOCTYPE svg [ <!ENTITY a "aaaa"> ]><svg>&a;</svg>',
    ],
    ['plain text', 'not markup'],
    ['empty', ''],
  ];

  for (const [label, text] of rejected) {
    it(`rejects ${label}`, () => {
      expect(isSvgDocument(Buffer.from(text))).toBe(false);
    });
  }

  it('rejects raster bytes', () => {
    expect(isSvgDocument(PNG_BYTES)).toBe(false);
  });
});

// Full-pipeline tests: a fake transport stands in for DNS + HTTP so the
// service's real fetch path — redirect following, per-hop SSRF re-checks,
// decompression, metadata parsing, favicon inlining, caching, in-flight
// dedup, and load shedding — runs end to end with no network.
describe('LinkPreviewService (pipeline)', () => {
  // Every URL below is valid and (except where the shed test asserts the
  // failure directly) the fetch queue never overflows, so no failure branch
  // is reachable — unwrap to keep the assertions on the preview itself.
  const getPreview = (svc: LinkPreviewService, url: string) =>
    svc.getPreview(url).then(R.unwrap);

  it('fails with the rejecting rule for input the fetcher would never attempt', async () => {
    const { transport, requested } = makeTransport(() => response(PAGE_HTML));
    const service = new LinkPreviewService(transport);

    await expect(service.getPreview('not-a-url')).resolves.toEqual(
      R.failure(UnfetchableUrl.Malformed),
    );
    await expect(service.getPreview('ftp://x.com/a')).resolves.toEqual(
      R.failure(UnfetchableUrl.UnsupportedScheme),
    );
    await expect(service.getPreview('http://x.com:8080/a')).resolves.toEqual(
      R.failure(UnfetchableUrl.ExplicitPort),
    );
    expect(requested).toHaveLength(0);
  });

  it('extracts metadata and inlines the favicon', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview).toEqual({
      url: 'https://example.com/article',
      title: 'Example Title',
      description: 'Example description.',
      siteName: 'Example Site',
      faviconDataUri: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
    });
    expect(requested).toEqual([
      'https://example.com/article',
      'https://example.com/fav.png',
    ]);
  });

  // PAGE_HTML above proves OpenGraph wins over the plain <title>; this pins
  // the fallback chain for pages without OpenGraph tags.
  it('falls back to twitter and plain-HTML tags when OpenGraph is missing', async () => {
    const html = `<html><head>
      <title>
        Plain
        Title
      </title>
      <meta name="twitter:description" content="Tweet description.">
    </head><body></body></html>`;
    const { transport } = makeTransport(() => response(html));
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/plain');

    expect(preview.title).toBe('Plain Title'); // whitespace collapsed too
    expect(preview.description).toBe('Tweet description.');
    expect(preview.siteName).toBeNull();
  });

  // A hostile page can pour its whole MAX_HTML_BYTES budget into one <meta>
  // tag; the field caps keep cache entries and JSON bodies bounded. The
  // emoji pins the cut point: truncation must not leave half a surrogate
  // pair at the end.
  it('caps runaway metadata field lengths', async () => {
    const html = `<html><head>
      <meta property="og:title" content="${'t'.repeat(299)}😀${'t'.repeat(9_000)}">
      <meta property="og:description" content="${'d'.repeat(9_000)}">
      <meta property="og:site_name" content="${'s'.repeat(9_000)}">
    </head><body></body></html>`;
    const { transport } = makeTransport(() => response(html));
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/huge');

    // The emoji's second half would be char 301 — dropped, not split.
    expect(preview.title).toBe('t'.repeat(299));
    expect(preview.description).toBe('d'.repeat(600));
    expect(preview.siteName).toBe('s'.repeat(100));
  });

  it('decompresses gzip pages before parsing', async () => {
    const { transport } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(gzipSync(Buffer.from(PAGE_HTML)), {
            'content-encoding': 'gzip',
          }),
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/zipped');
    expect(preview.title).toBe('Example Title');
  });

  it('follows redirects and reports the originally requested URL', async () => {
    const { transport, requested } = makeTransport((url) => {
      if (url.pathname === '/start') {
        return response('', { location: '/moved/final' }, 301);
      }
      if (url.pathname === '/moved/final') {
        return response(PAGE_HTML);
      }
      if (url.pathname === '/fav.png') {
        return response(PNG_BYTES, { 'content-type': 'image/png' });
      }
      return response('not found', {}, 404);
    });
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/start');

    expect(preview.title).toBe('Example Title');
    expect(preview.url).toBe('https://example.com/start');
    expect(requested.slice(0, 2)).toEqual([
      'https://example.com/start',
      'https://example.com/moved/final',
    ]);
  });

  it('gives up on endless redirect chains', async () => {
    const { transport, requested } = makeTransport((url) => {
      const n = Number(url.pathname.slice(2) || 0);
      return response('', { location: `/r${n + 1}` }, 302);
    });
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/r0');

    expect(preview.title).toBeNull();
    expect(preview.faviconDataUri).toBeNull();
    expect(requested.length).toBeLessThanOrEqual(4); // initial + MAX_REDIRECTS
  });

  it('blocks redirects to hosts that resolve to private addresses', async () => {
    const { transport, requested } = makeTransport(
      (url) =>
        url.hostname === 'public.test'
          ? response('', { location: 'http://internal.test/admin' }, 302)
          : response(PAGE_HTML),
      { 'internal.test': '10.0.0.1' },
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'http://public.test/page');

    expect(preview.title).toBeNull();
    expect(requested).toEqual(['http://public.test/page']);
  });

  it('returns an empty preview for non-HTML responses without probing a favicon', async () => {
    const { transport, requested } = makeTransport(() =>
      response('%PDF-1.4', { 'content-type': 'application/pdf' }),
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/doc.pdf');

    expect(preview.title).toBeNull();
    expect(requested).toEqual(['https://example.com/doc.pdf']);
  });

  // "Not an HTML page" is a durable verdict deserving the full cache TTL;
  // a transient fetch failure gets the short one so the site is re-probed.
  it('caches the non-HTML verdict longer than a transient failure', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/doc.pdf'
        ? response('%PDF-1.4', { 'content-type': 'application/pdf' })
        : response('down', {}, 503),
    );
    const service = new LinkPreviewService(transport);

    await getPreview(service, 'https://example.com/doc.pdf');
    await getPreview(service, 'https://example.com/flaky');

    // Past the short empty-preview TTL but inside the full preview TTL.
    service['sweepExpired'](Date.now() + 30 * 60 * 1000);

    await getPreview(service, 'https://example.com/doc.pdf'); // still cached
    await getPreview(service, 'https://example.com/flaky'); // re-fetched
    expect(requested).toEqual([
      'https://example.com/doc.pdf',
      'https://example.com/flaky',
      'https://example.com/flaky',
    ]);
  });

  it('serves repeat lookups from the cache', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    const first = await getPreview(service, 'https://example.com/article');
    const second = await getPreview(service, 'https://example.com/article');

    expect(second).toEqual(first);
    expect(requested).toHaveLength(2); // page + favicon, once each
  });

  // The caches must not retain a burst of unique URLs forever: the periodic
  // sweep (driven here directly via its test-only `now` parameter) reclaims
  // expired entries, after which the same URL is fetched fresh.
  it('sweeps expired entries out of both caches', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    await getPreview(service, 'https://example.com/article');
    expect(service['cache'].size).toBe(1);
    expect(service['faviconCache'].size).toBe(1);

    // Not yet expired — the sweep must leave live entries alone.
    service['sweepExpired']();
    expect(service['cache'].size).toBe(1);
    expect(service['faviconCache'].size).toBe(1);

    // Past every TTL (favicons keep the longest one), all entries go.
    service['sweepExpired'](Date.now() + 25 * 60 * 60 * 1000);
    expect(service['cache'].size).toBe(0);
    expect(service['faviconCache'].size).toBe(0);

    await getPreview(service, 'https://example.com/article');
    expect(requested).toHaveLength(4); // page + favicon, twice
  });

  // Fragments never go on the wire, so anchor links into one page are the
  // same fetch — they must share a cache entry instead of each burning a
  // request and a slice of the rate-limit budget.
  it('ignores URL fragments when caching', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    const first = await getPreview(service, 'https://example.com/article#one');
    const second = await getPreview(service, 'https://example.com/article#two');

    expect(first.url).toBe('https://example.com/article');
    expect(second).toEqual(first);
    expect(requested).toHaveLength(2); // page + favicon, once each
  });

  it('dedupes concurrent fetches of the same URL', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    const [a, b] = await Promise.all([
      getPreview(service, 'https://example.com/article'),
      getPreview(service, 'https://example.com/article'),
    ]);

    expect(a).toEqual(b);
    expect(requested).toHaveLength(2); // page + favicon, once each
  });

  // Declared icons go stale (404 after an asset-pipeline change) while the
  // conventional path keeps working — one dead candidate must not cost the
  // preview its icon.
  it('falls back to /favicon.ico when the declared icon is stale', async () => {
    const { transport, requested } = makeTransport((url) => {
      if (url.pathname === '/fav.png') {
        return response('gone', {}, 404);
      }
      if (url.pathname === '/favicon.ico') {
        return response(PNG_BYTES, { 'content-type': 'image/png' });
      }
      return response(PAGE_HTML);
    });
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview.faviconDataUri).toMatch(/^data:image\/png/);
    expect(requested).toEqual([
      'https://example.com/article',
      'https://example.com/fav.png',
      'https://example.com/favicon.ico',
    ]);
  });

  it('rasterizes an SVG favicon into an inlined PNG', async () => {
    const svgIcon = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
        '<circle cx="16" cy="16" r="14" fill="tomato"/></svg>',
    );
    const svgPage =
      '<html><head><link rel="icon" href="/fav.svg"></head></html>';
    const { transport } = makeTransport((url) =>
      url.pathname === '/fav.svg'
        ? response(svgIcon, { 'content-type': 'image/svg+xml' })
        : response(svgPage),
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview.faviconDataUri).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(preview.faviconDataUri!.split(',')[1], 'base64');
    expect(sniffImageMime(png)).toBe('image/png');
  });

  // Rasterization is the sanitizer: scripts and event handlers can't
  // survive into pixels, and the external reference must never be fetched —
  // the transport sees only the page and the icon itself (librsvg does not
  // load remote resources, and would bypass the SSRF guard if it did).
  it('rasterizes hostile SVG to inert pixels without fetching its references', async () => {
    const hostileSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" onload="alert(1)">' +
        '<script>alert(2)</script>' +
        '<image href="https://internal.test/secret"/>' +
        '<rect width="32" height="32" fill="blue"/></svg>',
    );
    const svgPage =
      '<html><head><link rel="icon" href="/fav.svg"></head></html>';
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.svg'
        ? response(hostileSvg, { 'content-type': 'image/svg+xml' })
        : response(svgPage),
    );
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview.faviconDataUri).toMatch(/^data:image\/png;base64,/);
    expect(requested).toEqual([
      'https://example.com/article',
      'https://example.com/fav.svg',
    ]);
  });

  // Entity definitions never reach the XML parser at all — isSvgDocument
  // refuses internal doctype subsets, so the lookup falls through to the
  // remaining candidates.
  it('refuses SVG with entity definitions instead of rasterizing', async () => {
    const entityBomb = Buffer.from(
      '<!DOCTYPE svg [ <!ENTITY a "x"> ]>' +
        '<svg xmlns="http://www.w3.org/2000/svg">&a;</svg>',
    );
    const svgPage =
      '<html><head><link rel="icon" href="/fav.svg"></head></html>';
    const { transport, requested } = makeTransport((url) => {
      if (url.pathname === '/fav.svg') {
        return response(entityBomb, { 'content-type': 'image/svg+xml' });
      }
      if (url.pathname === '/favicon.ico') {
        return response('gone', {}, 404);
      }
      return response(svgPage);
    });
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview.faviconDataUri).toBeNull();
    expect(requested).toEqual([
      'https://example.com/article',
      'https://example.com/fav.svg',
      'https://example.com/favicon.ico',
    ]);
  });

  // The byte cap bounds the SVG source, not the raster it declares: a tiny
  // file claiming huge intrinsic dimensions must be refused by the input
  // pixel limit instead of allocating the full-size buffer, and the lookup
  // falls through to the remaining candidates.
  it('refuses SVG declaring enormous dimensions instead of rasterizing', async () => {
    const pixelBomb = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000">' +
        '<rect width="100000" height="100000" fill="blue"/></svg>',
    );
    const svgPage =
      '<html><head><link rel="icon" href="/fav.svg"></head></html>';
    const { transport, requested } = makeTransport((url) => {
      if (url.pathname === '/fav.svg') {
        return response(pixelBomb, { 'content-type': 'image/svg+xml' });
      }
      if (url.pathname === '/favicon.ico') {
        return response(PNG_BYTES, { 'content-type': 'image/png' });
      }
      return response(svgPage);
    });
    const service = new LinkPreviewService(transport);

    const preview = await getPreview(service, 'https://example.com/article');

    expect(preview.faviconDataUri).toBe(
      `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
    );
    expect(requested).toEqual([
      'https://example.com/article',
      'https://example.com/fav.svg',
      'https://example.com/favicon.ico',
    ]);
  });

  it('fetches the favicon once per origin', async () => {
    const { transport, requested } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    const service = new LinkPreviewService(transport);

    await getPreview(service, 'https://example.com/one');
    await getPreview(service, 'https://example.com/two');

    const faviconHits = requested.filter((href) => href.endsWith('/fav.png'));
    expect(faviconHits).toHaveLength(1);
  });

  // Different pages on one origin miss the favicon cache together (a post
  // full of links to the same site); the in-flight dedup must collapse them
  // into a single icon fetch.
  it('dedupes concurrent favicon fetches for the same origin', async () => {
    let releaseFavicon!: () => void;
    const faviconGate = new Promise<void>(
      (resolve) => (releaseFavicon = resolve),
    );
    const { transport, requested } = makeTransport(async (url) => {
      if (url.pathname === '/fav.png') {
        await faviconGate;
        return response(PNG_BYTES, { 'content-type': 'image/png' });
      }
      return response(PAGE_HTML);
    });
    const service = new LinkPreviewService(transport);

    const previews = Promise.all([
      getPreview(service, 'https://example.com/one'),
      getPreview(service, 'https://example.com/two'),
    ]);
    // Let both page fetches complete and both callers reach the favicon
    // step while the (single) favicon request is still pending.
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    releaseFavicon();

    const [a, b] = await previews;
    expect(a.faviconDataUri).toMatch(/^data:image\/png/);
    expect(b.faviconDataUri).toBe(a.faviconDataUri);
    expect(requested.filter((href) => href.endsWith('/fav.png'))).toHaveLength(
      1,
    );
  });

  // A slow page can exhaust the shared deadline before the favicon fetch
  // starts. That abort says nothing about the origin's icon, so it must not
  // be negative-cached (which would blank the favicon for the whole origin
  // until the empty-favicon TTL runs out).
  it('does not negative-cache the favicon when the shared deadline aborted it', async () => {
    const { transport } = makeTransport((url) =>
      url.pathname === '/fav.png'
        ? response(PNG_BYTES, { 'content-type': 'image/png' })
        : response(PAGE_HTML),
    );
    // Mirror the real transport, which rejects rather than dialing out when
    // the request's signal is already aborted.
    const service = new LinkPreviewService({
      ...transport,
      request: (url, target, options) =>
        options.signal.aborted
          ? Promise.reject(new Error('This operation was aborted'))
          : transport.request(url, target, options),
    });

    const $ = cheerio.load(PAGE_HTML, {
      baseURI: 'https://example.com/slow',
    });
    const spentDeadline = AbortSignal.abort();
    const aborted = await service['getFavicon'](
      $,
      new URL('https://example.com/slow'),
      spentDeadline,
    );
    expect(aborted).toBeNull();
    expect(service['faviconCache'].size).toBe(0);

    // The next page on the origin, with a live deadline, gets the icon.
    const preview = await getPreview(service, 'https://example.com/article');
    expect(preview.faviconDataUri).toMatch(/^data:image\/png/);
  });

  it('sheds load past the fetch queue without caching the shed URL', async () => {
    const pendingPages: Array<() => void> = [];
    const { transport } = makeTransport((url) => {
      if (url.pathname.startsWith('/p')) {
        return new Promise((resolve) => {
          pendingPages.push(() => resolve(response(PAGE_HTML)));
        });
      }
      if (url.pathname === '/fav.png') {
        return response(PNG_BYTES, { 'content-type': 'image/png' });
      }
      return response(PAGE_HTML);
    });
    const service = new LinkPreviewService(transport);

    // Saturate the limiter: MAX_CONCURRENT_FETCHES active (gated at the
    // transport) + MAX_QUEUED_FETCHES queued behind them.
    const saturating = Array.from({ length: 40 }, (_, i) =>
      getPreview(service, `https://example.com/p${i}`),
    );
    await new Promise((resolve) => setImmediate(resolve));

    // The 41st is shed: an immediate retryable failure — not an empty
    // preview, which the caller couldn't tell from a page without metadata.
    await expect(
      service.getPreview('https://example.com/overflow'),
    ).resolves.toEqual(R.failure(PreviewUnavailable.Overloaded));

    // Drain: releasing a gated page lets a queued fetch reach the
    // transport, which pushes a new gate — pump until all 40 settle.
    let settled = false;
    const all = Promise.all(saturating).then(() => {
      settled = true;
    });
    while (!settled) {
      while (pendingPages.length > 0) {
        pendingPages.shift()!();
        await new Promise((resolve) => setImmediate(resolve));
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    await all;

    // Shedding must not have cached an empty result: with capacity free,
    // the same URL now yields a real preview.
    const retried = await getPreview(service, 'https://example.com/overflow');
    expect(retried.title).toBe('Example Title');
  }, 10_000);
});

# Outside sources

Checked 2026-11-16 by a research subagent and a Codex second opinion. Status per root `AGENTS.md` **Established practice**.

## Redirects

- RFC 9110 §15.4: a client may change POST to GET on `301`/`302`; `307`/`308` keep method and body. Formal standard. https://www.rfc-editor.org/rfc/rfc9110#section-15.4
- Fetch: browsers change POST to GET on `301`/`302` and drop `Authorization` on a cross-origin redirect (whatwg/fetch #1544, shipped in Chromium and Firefox 111+). Formal standard. https://fetch.spec.whatwg.org/#http-redirect-fetch
- OkHttp, which React Native's `fetch` uses on Android, drops `Authorization` when a redirect changes host (`RetryAndFollowUpInterceptor`). Common practice, from source and bug reports. https://github.com/trinodb/trino/issues/21026
- NSURLSession, used on iOS, does not carry `Authorization` across redirects; Apple lists it among reserved headers. Vendor recommendation. https://developer.apple.com/documentation/foundation/urlrequest#Reserved-HTTP-Headers, https://github.com/facebook/react-native/issues/15918
- RFC 6455 §4.1: a client need not follow a redirect on the websocket handshake; the WHATWG WebSockets standard fails the connection. Formal standard. https://www.rfc-editor.org/rfc/rfc6455#section-4.1, https://websockets.spec.whatwg.org/#opening-handshake
- RFC 9110 §15.5.11: `410 Gone` means the resource was removed intentionally. Formal standard. https://www.rfc-editor.org/rfc/rfc9110#section-15.5.11
- No standard sets a traffic threshold or waiting period for retiring old clients. RFC 8594 (`Sunset`, informational) and RFC 9745 (`Deprecation`, standards track) need clients that read them, which these builds don't.

## Images

- Image loads are no-cors with redirect mode "follow" and send no credentials. Formal standard (Fetch).
- React Native's image loaders (Fresco on OkHttp, RCTImageLoader on NSURLSession) follow redirects by default. Common practice, from library defaults.
- Google recommends permanent server-side redirects for moved URLs, kept at least a year. Vendor recommendation. https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

## nginx

- Regex locations win over prefix locations unless the prefix is `^~`; rewrite-module directives at server level run before a location is selected. Vendor documentation. https://nginx.org/en/docs/http/ngx_http_core_module.html#location, https://nginx.org/en/docs/http/ngx_http_rewrite_module.html

# Measurements

## Mobile clients still on code that calls the legacy hosts

2026-11-17, HogQL against the production PostHog project, events with `$lib = 'posthog-react-native'`.

- OTA updates reach only store builds whose native fingerprint matches the publishing commit (`.github/workflows/publish-mobile-ota.yaml`), and the app applies one at cold launch through its OTA gate (`apps/mobile/lib/useOtaUpdateGate.ts`). Events carry no update id, so old and new JavaScript can't be told apart directly.
- Past 14 days by `$app_version`: 1.3.6 on iOS (78 people), Android (20) and iPadOS (1); 1.3.1 on iOS (1 person, last seen 2026-11-11).
- `ota_gate_resolved` outcomes 2026-11-10 to 2026-11-17: `check_error` dominates every day (e.g. 25 of 34 on 2026-11-16); `applied` appears 1 to 6 times a day.
- Since 2026-11-13: 43 people used the app; 8 resolved the gate as `applied` or `no_update`, the only confirmation of running code from #979 (2026-11-12) or later.

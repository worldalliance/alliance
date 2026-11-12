# Evidence

## Live hosts before the change

Method: `curl` and `openssl s_client` from a workstation, 2026-11-11.

- `https://worldalliance.org/api/`, `https://staging.worldalliance.org/api/`, `https://staging.thealliance.org/api/`, both association files and `/events/static/array.js` on `staging.thealliance.org` all answered `200`, so the health checks' stricter `200` requirement holds today.
- Rerun 2026-11-12 over both domains of each environment and production's `www.` hosts: `/api/`, both association files and `/events/static/array.js` on `worldalliance.org`, `thealliance.org`, `staging.worldalliance.org`, `staging.thealliance.org`, `www.worldalliance.org` and `www.thealliance.org`, 24 URLs in all, each answered `200`.
- The certificate served on `staging.thealliance.org` is the `staging.worldalliance.org` lineage (subject CN), covering both staging names. Whether a `staging.thealliance.org` lineage exists on the box can't be seen from outside; the new deploy check reports it.

## Vendor requirements

Vendor documentation, read 2026-11-12.

- Apple, [Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains): "You must host the file using https:// with a valid certificate and with no redirects."
- Android, [Configure assetlinks.json](https://developer.android.com/training/app-links/configure-assetlinks): "The assetlinks.json file must be accessible without any redirects (no 301 or 302 redirects)."

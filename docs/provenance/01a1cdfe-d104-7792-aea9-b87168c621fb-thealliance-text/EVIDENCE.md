# Evidence

## New-host URLs answer before the cutover

Checked 2026-11-11 with `curl -s -o /dev/null -w '%{http_code}'` and `dig +short`.

- `https://thealliance.org/governance`, `/actions/47`, `/faq`, `/tasks?cid=123` and `/api/images/1759964091349.webp` return 200. `/guide` returns 301 to `/guide/`, the same as on the legacy host.
- `metrics.worldalliance.org` resolves to an address; `metrics.thealliance.org` has no A record.

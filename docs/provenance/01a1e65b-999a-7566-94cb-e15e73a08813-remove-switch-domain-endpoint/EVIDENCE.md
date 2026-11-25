# Measurements

## Production calls to POST /user/switch-domain

Method: on the monitoring host, queried Prometheus for `http_request_duration_seconds_count{route=~".*switch-domain.*"}` over the last 30 days (`query_range`, hourly step) and `increase(...)` over 1, 4 and 6 days. Checked 2026-11-16 21:55 UTC.

- The only series is `POST /user/switch-domain`, status 201, from the production API, with samples from 2026-11-06 20:55 to 2026-11-07 00:55 UTC and a count of 1. That shows the metric records the route when it's called.
- No samples after 2026-11-07, and `increase` over 1, 4 and 6 days is empty. The production cutover (#981) merged 2026-11-12.

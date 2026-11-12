# Decisions

- `docs/legacy/monitoring.md` keeps `metrics.worldalliance.org`, though ALL-2144 lists it. The doc describes the live Grafana host, and `metrics.thealliance.org` has no DNS record (EVIDENCE.md). Moving metrics is ALL-2110, which should update the doc when the host exists. Agent decision.
- The Open Graph images `apps/frontend/public/og-home.png` and `og-signup.png` are regenerated with `scripts/brand/og.py`, since the generator's text only reaches the site through them. The YouTube art isn't checked in, so it waits for someone to rerun `scripts/brand/youtube.py` and upload it. Agent decision.
- Content links point at thealliance.org before the production cutover (ALL-2140): both domains already serve the same app. Agent decision, resting on EVIDENCE.md.

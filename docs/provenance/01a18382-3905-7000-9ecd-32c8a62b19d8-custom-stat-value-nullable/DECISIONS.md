# Decisions

- `ActionStatsService` is the only writer of the value. Create and update no longer take it, and the validation pipe's whitelist strips it from a request that sends it. Admin's form seeds from the fetched action and sent the value back on every save and duplicate, overwriting the computed value with the one from page load.
- Pasting an exported action still copies the value; the cron recomputes it for an action that tracks a stat.

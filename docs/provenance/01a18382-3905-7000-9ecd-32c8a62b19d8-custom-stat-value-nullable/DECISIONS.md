# Decisions

- The value stays nullable: an action whose stat has not been computed is `NULL`, so the property is `customStatValue: number | null` and the API publishes it as a required nullable number. No migration; the column is already a nullable integer.
- `ActionStatsService` is the only writer of the value. Create and update no longer take it, and the validation pipe's whitelist strips it from a request that sends it. Admin's form seeds from the fetched action and sent the value back on every save and duplicate, overwriting the computed value with the one from page load. That lands first, so the input DTOs never publish the new nullable type.
- Pasting an exported action still copies the value; the cron recomputes it for an action that tracks a stat.

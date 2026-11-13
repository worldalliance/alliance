# Decisions

- **`with-secrets.test.ts` is split** into a shared fixture (`lib/with-secrets-fixture.ts`), the permanent tests, and `with-secrets-fallback.test.ts` for the `BACKCOMPAT(ALL-1964)` fallback, which ALL-2208 deletes whole. A codex read-only consult proposed this split when the new tests would have taken the file past 500 non-blank lines.

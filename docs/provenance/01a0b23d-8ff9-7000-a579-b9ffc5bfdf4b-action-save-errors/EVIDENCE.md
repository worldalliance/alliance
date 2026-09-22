# Checks

- `bun run test apps/admin` from the repo root exited 0 with 210 passing tests, including fourteen action-save error cases.
- `bun run typecheck` from `apps/admin/` exited 0 with the existing unspecified React version warning.
- With the `logActionSaveError` mapper removed from both save calls, `bun run typecheck` from `apps/admin/` reported 2 type errors.
- `bun run format:check` on the changed files and `git diff --check` from the repo root each exited 0.
- In Playwright against the local admin, stubbed save responses showed the expected banner text: the server's message for 409 and 400, the session-expired message for 401, and "Failed to save action" for 503 and an HTML 502. Each failure scrolled the banner into view, including a second failure in a row.

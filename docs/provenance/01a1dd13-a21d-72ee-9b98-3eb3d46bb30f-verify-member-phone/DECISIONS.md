# Decisions

The work is planned as separate PRs, each with its Linear issue. This directory covers the first, the server; each later PR gets its own directory naming this one.

1. ALL-2246, server: verified-at date, one-number-per-account constraint, send-code and verify-code endpoints.
2. ALL-2247, the Slack alert link for inbound texts (REQUIREMENTS.md), which needs only the constraint.
3. ALL-2248, web: the code step in settings and after a form's phone question, and the "Confirm your number" prompt.
4. ALL-2249, mobile: the same.
5. ALL-2250, stop saving numbers without a code, once no client older than the code step is in use.

## Server

- **`hasPassword`, `loadedUserTags` and `loadedUserCommunities` moved from `user.entity.ts` to `user.utils.ts`.** The entity would pass 500 non-blank lines with the verified-at column this task adds; of the three splits a codex subagent proposed, this one moves functions that don't touch the class and leaves every import of `User` alone. (agent decision under root `AGENTS.md` **File size**)

# Decisions

The work is planned as separate PRs, each with its Linear issue. This directory covers the first, the server; each later PR gets its own directory naming this one.

1. ALL-2246, server: verified-at date, the code that handles the one-number-per-account constraint, send-code and verify-code endpoints.
2. ALL-2259, the unique index behind the one-number-per-account constraint, once the first is live.
3. ALL-2247, the Slack alert link for inbound texts (REQUIREMENTS.md), which needs only the constraint.
4. ALL-2248, web: the code step in settings and after a form's phone question, and the "Confirm your number" prompt.
5. ALL-2249, mobile: the same.
6. ALL-2250, stop saving numbers without a code, once no client older than the code step is in use.

## Server

- **`hasPassword`, `loadedUserTags` and `loadedUserCommunities` moved from `user.entity.ts` to `user.utils.ts`.** The entity would pass 500 non-blank lines with the verified-at column this task adds; of the three splits a codex subagent proposed, this one moves functions that don't touch the class and leaves every import of `User` alone. (agent decision under root `AGENTS.md` **File size**)
- **`otpRefusalException` takes the purpose**, because its delivery-failure copy told the caller to "use another sign-in method", which is wrong for confirming a phone number. (agent decision)
- **The one-account rule will be a unique index on `user.phoneNumber` over rows where `deletedAt IS NULL`, added by ALL-2259 once this PR's server is live**, the shape `user.email` already has, named `UQ_user_phone_number_live` so a write that loses a race to it can be told apart from other unique violations. This PR ships the code that handles a violation of it and names it in `PHONE_NUMBER_INDEX`; until ALL-2259 lands nothing stops two live accounts holding one number. Root `AGENTS.md` **Breaking changes** has a migration and the server deploy land at different times, and `scripts/deploy_backend.sh` migrates before it restarts the server and keeps migrations on rollback, so an index shipped with its handling code would meet a server that answers its violation with a 500. ALL-2259 rechecks the production duplicate count with the query in EVIDENCE.md before it migrates. Once the index exists, a restore of a deleted account whose number a live account has since taken fails at it; restores are done by hand by an operator, who then clears one of the two. The user deferred how the constraint ships, in one deploy or two. (agent decision, user deferred the choice)
- **The refusal names the cause.** EVIDENCE.md records that the two research reports differed on explicit against neutral wording; the neutral form implies the same fact and says less about what to do. "Linked to an account" follows the second report: an unverified record doesn't show whose the number is. The user was asked and had not chosen when the design moved to verification, so this is open to change. (agent decision)

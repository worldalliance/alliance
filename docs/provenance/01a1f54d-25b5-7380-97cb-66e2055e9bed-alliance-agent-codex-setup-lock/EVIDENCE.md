# Evidence

## Serialising setup of a shared CODEX_HOME

Question: how do independent processes sharing one CODEX_HOME avoid racing on its setup? Checked 2026-11-19 by a researcher subagent.

- [openai/codex#35555](https://github.com/openai/codex/issues/35555), vendor bug report, open: Codex clients sharing `$CODEX_HOME` fail at startup when another process holds a write lock on `logs_2.sqlite`; a commenter reproduces it with several `codex app-server` processes started at once on a fresh home. No maintainer states whether that use is supported.
- [Codex network file systems guide](https://learn.chatgpt.com/docs/environments/network-file-systems.md), vendor recommendation: batch jobs set `CODEX_SQLITE_HOME` to a private local directory each "so workers don't contend for the same database". It covers SQLite state only, not `config.toml`.
- [proper-lockfile README](https://github.com/moxystudio/node-proper-lockfile), vendor documentation, common practice for Node: locks with an atomic `mkdir`, refreshes the lock's mtime while held, treats it as stale after 10 seconds by default, retries 0 times by default, and throws from `onCompromised` by default. Latest version 4.1.2 on npm.
- [SQLite locking](https://www.sqlite.org/lockingv3.html), vendor documentation: SQLite uses POSIX advisory locks between processes on Unix; it does not address concurrent creation of a database.

## Codebase facts the choice rests on

Read on origin/main at 2c5eb2ec07, 2026-11-19.

- The development CODEX_HOME is `<appData>/Alliance agent (dev)/codex` (`agents/desktop/src/main/dev-app-data.ts`), separate from a developer's own `~/.codex`, so their own `codex` CLI never shares it.
- Each checkout's development app keeps its user data, and with it its single-instance lock, at `<checkout>/agents/desktop/.scratch/user-data` (`agents/desktop/src/main/index.ts`), so a CODEX_HOME there would need a Codex sign-in per worktree, deleted with the worktree.
- `trustRepositoryHooks` re-lists hooks after writing trust and fails setup if any stay untrusted (`agents/desktop/src/main/agent/codex/trust.ts`), so a lost trust write already fails loudly.

## Codex 0.167.0's credential names

Measured 2026-11-19 on `@openai/codex@0.167.0` (`vendor/aarch64-apple-darwin/bin/codex` in the bun cache) with `strings -n 4 <binary> | grep -oE 'CODEX_[A-Z_]*'`.

- The `CODEX_` names holding `KEY` or `TOKEN` as a word are `CODEX_API_KEY`, `CODEX_ACCESS_TOKEN`, `CODEX_CONNECTORS_TOKEN`, `CODEX_GUARDIAN_DECISIONS_API_KEY`, `CODEX_EXEC_SERVER_NOISE_AUTH_TOKEN` and `CODEX_GITHUB_PERSONAL_ACCESS_TOKEN`, each ending in that word, and `CODEX_REFRESH_TOKEN_URL_OVERRIDE` and `CODEX_REVOKE_TOKEN_URL_OVERRIDE`, endpoint settings.
- Codex's default exclusions for its shell commands' environment, found as one string run (`grep -o '\*KEY\*\*TOKEN\*[A-Z_]*'`), are the globs `*KEY*` and `*TOKEN*` followed by a named list: `CODEX_THREAD_ID`, `CODEX_TOOL_CALL_ID`, `CODEX_EXEC_SERVER_NOISE_AUTH_TOKEN`, `NODE_REPL_AUTH_TOKEN`, `CODEX_GUARDIAN_DECISIONS_API_KEY`, `OPENAI_FEDERATION_RULE_ID`, `OPENAI_IDENTITY_TOKEN_FILE` and `OPENAI_WORKLOAD_IDENTITY_CONTEXT`.

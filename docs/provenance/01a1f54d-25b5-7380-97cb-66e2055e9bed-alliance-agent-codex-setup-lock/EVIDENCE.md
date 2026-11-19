# Evidence

## Codex 0.167.0's credential names

Measured 2026-11-19 on `@openai/codex@0.167.0` (`vendor/aarch64-apple-darwin/bin/codex` in the bun cache) with `strings -n 4 <binary> | grep -oE 'CODEX_[A-Z_]*'`.

- The `CODEX_` names holding `KEY` or `TOKEN` as a word are `CODEX_API_KEY`, `CODEX_ACCESS_TOKEN`, `CODEX_CONNECTORS_TOKEN`, `CODEX_GUARDIAN_DECISIONS_API_KEY`, `CODEX_EXEC_SERVER_NOISE_AUTH_TOKEN` and `CODEX_GITHUB_PERSONAL_ACCESS_TOKEN`, each ending in that word, and `CODEX_REFRESH_TOKEN_URL_OVERRIDE` and `CODEX_REVOKE_TOKEN_URL_OVERRIDE`, endpoint settings.
- Codex's default exclusions for its shell commands' environment, found as one string run (`grep -o '\*KEY\*\*TOKEN\*[A-Z_]*'`), are the globs `*KEY*` and `*TOKEN*` followed by a named list: `CODEX_THREAD_ID`, `CODEX_TOOL_CALL_ID`, `CODEX_EXEC_SERVER_NOISE_AUTH_TOKEN`, `NODE_REPL_AUTH_TOKEN`, `CODEX_GUARDIAN_DECISIONS_API_KEY`, `OPENAI_FEDERATION_RULE_ID`, `OPENAI_IDENTITY_TOKEN_FILE` and `OPENAI_WORKLOAD_IDENTITY_CONTEXT`.

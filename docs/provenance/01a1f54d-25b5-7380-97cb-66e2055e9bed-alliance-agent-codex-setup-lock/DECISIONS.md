# Decisions

## Lock timings

The lock is a directory, `alliance-agent-setup.lock`, inside the home, with proper-lockfile's defaults: a holder refreshes it every 5 seconds and a lock untouched for 10 seconds counts as stale, so a crashed app frees it. A waiter polls every 500 ms for up to 60 seconds, twice the backend's 30-second setup timeout, and then fails with a message saying another Alliance agent may be setting Codex up there. proper-lockfile's own retries cover every error, so the helper polls itself and retries only `ELOCKED`: any other error, such as `EACCES`, fails at once with a message naming it. The 60 seconds bounds the whole wait rather than each holder: polling isn't fair, so a waiter behind one app's back-to-back setups can time out, where a bound per holder could leave it waiting indefinitely (agent decision).

## A compromised lock is logged

proper-lockfile's default on a compromised lock (its directory removed or its refresh failing) throws from a timer, which would crash the Electron main process. The setup already running can only finish, so the app logs the loss and carries on. A crash can also let two waiters both take the lock: proper-lockfile's stale takeover checks, removes and recreates the directory in separate steps, so one waiter can remove the lock another has just taken, and that holder learns of it only from this log. That needs two processes taking over the same stale lock within the same instant, which the few apps sharing a home make rare (agent decision).

## Option research

Before the user chose the lock, a brainstormer, a researcher and a second opinion compared it with a CODEX_HOME per checkout and a per-checkout `CODEX_SQLITE_HOME`. Their findings are in `EVIDENCE.md`.

## Each CLI's environment filter

Claude processes drop `OPENAI_*` by prefix and every `CODEX_` name ending in the word `KEY` or `TOKEN` by pattern, which matches every `CODEX_` credential Codex 0.167.0 reads and any later one named that way, where a hand-kept list would miss it (`EVIDENCE.md`, "Codex 0.167.0's credential names"). The pattern covers less than Codex's own child-environment filter, which drops any name holding `KEY` or `TOKEN` plus a named list: settings such as `CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT`, `CODEX_REFRESH_TOKEN_URL_OVERRIDE` and `CODEX_CA_CERTIFICATE` pass through, as the requirements ask of non-credential `CODEX*` names, and so does `NODE_REPL_AUTH_TOKEN`, outside both namespaces, which Codex sets for its own REPL child. Codex processes drop `CLAUDE*` by prefix beside `ANTHROPIC_*`. This supersedes the Environment decision in `01a1c699-aec2-75f8-a5bc-f1cfa81f6b09-alliance-agent-claude-adapter`, the `codexEnvironment` decision in `01a1eb56-c1a4-7029-9df3-911550b88646-alliance-agent-codex-adapter`, and extends the Credentials decision in `01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app`, which drop only `OPENAI_API_KEY` from Claude and only `ANTHROPIC_*` and `CLAUDE_CODE_OAUTH_TOKEN` from Codex. The user's other credentials are ALL-2377's to decide (agent decision).

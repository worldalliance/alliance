## Where the binaries come from

The CLIs are the vendors' npm packages, `@anthropic-ai/claude-code` and `@openai/codex`, pinned exactly as devDependencies of `agents/desktop` (agent decision; EVIDENCE.md, Sources). Each lists its per-platform binary packages as optional dependencies, and `bun.lock` records a sha512 for every platform's package, so the install verifies whichever it fetches. The meta packages are pinned rather than the platform packages, so each CLI is one entry a bump changes and a development build works on macOS and Linux, arm64 or x64, the platforms the app runs the CLIs on. They are devDependencies so electron-builder leaves them out of `app.asar`; its `extraResources` copies the host platform's binaries instead. Anthropic also publishes a GPG-signed manifest of SHA256 hashes, which would add provenance on top of the registry's integrity check; it was left out as a second mechanism no bump bot understands.

The app runs Codex's native binary, not the npm package's `bin/codex.js`, which only finds that binary and sets `CODEX_MANAGED_BY_*` for Codex's update hints, which the app turns off (EVIDENCE.md, Codex's npm launcher).

## Development builds run the bundled copies

A development build runs the CLIs from `node_modules`, so a developer's own auto-updating `claude` never meets the version check again, which blocked every message once it updated (agent decision, stated to the user beside the task's questions). The PATH lookup is gone. `ALLIANCE_AGENT_CLAUDE_EXECUTABLE` and `ALLIANCE_AGENT_CODEX_EXECUTABLE` still name an executable to run instead, for the tests' stubs and the capture runs, and now fail when they name no executable file rather than resolving to a path that fails at spawn. The tests that had found a CLI installed on PATH while the app ran now name a missing file that then appears, since leaving the variable unset would run the real bundled CLI in a test. The exact-version check stays, since a variable can name any version; its failure tells a development build to run `bun install`, the fix once a bump is pulled. When a CLI can't be checked, the sign-in panel's summary no longer says to install the CLI, which wouldn't change the one the app runs; its wording is in REQUIREMENTS.md, Sign-in panel.

`CLAUDE_CODE_VERSION` and `CODEX_VERSION` are read from `package.json`, which a zod check holds to exact versions, so a bump changes one place.

## One environment for both CLIs

Each CLI's environment used to drop the other vendor's namespaces and set only its own private folder, so a `claude -p` that a Codex session starts ran with the user's own `~/.claude`, and a `codex` that a Claude session starts with the user's `~/.codex`. So every CLI the app runs gets one environment, `agentEnvironment` in `src/main/agent/agent-environment.ts`: it drops both vendors' namespaces (`CLAUDE*`, `ANTHROPIC_*`, `CODEX*` but `CODEX_CA_CERTIFICATE`, `OPENAI_*`) and sets `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and Claude's three traffic variables (agent decision). Claude processes therefore now drop Codex's non-credential settings too, such as `CODEX_REFRESH_TOKEN_URL_OVERRIDE`, which a Codex they start would read. Every check for a CLI creates `CODEX_HOME`, since a `codex` that a Claude session starts refuses every command but `--version` without it.

## Linux libc

Claude's Linux binaries come in glibc and musl builds; the app runs the glibc one, and Codex's Linux build is statically linked against musl. On a musl distribution Claude fails to start, with the error the spawn reports; the app doesn't detect musl (agent decision, YAGNI while Linux targets Debian-based distributions).

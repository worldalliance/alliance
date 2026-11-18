# Evidence

## Codex `spawn_agent` switches

Method: `codex exec -s read-only --json` from the repo root with a prompt asking it to call `spawn_agent` for a subagent that replies OK, once per setting; a `collab_tool_call` event and a returned `task_name` mean it spawned. `codex-cli` 0.167.0, macOS, 2026-11-18.

- `[features] multi_agent = false` in a project `.codex/config.toml`: `codex features list` showed it `false`, and `spawn_agent` still spawned.
- `-c features.multi_agent=false` / `true`, `--disable multi_agent --disable multi_agent_v2`, `-c features.enable_fanout=false`, `--disable code_mode_host`, `-c agents.max_depth=0`: each spawned.
- `-c agents.max_threads=0`: rejected, `agents.max_concurrent_threads_per_session must be at least 1`.
- A PreToolUse hook added to `.codex/hooks.json`, with matcher `.*` and with none, that logged its stdin: it never ran, not even for a shell call in the same run. The edit was never trusted through `/hooks`, and Codex skips new or changed hooks until they are (`agents/README.md`), so whether a trusted hook can deny `spawn_agent` is untested.

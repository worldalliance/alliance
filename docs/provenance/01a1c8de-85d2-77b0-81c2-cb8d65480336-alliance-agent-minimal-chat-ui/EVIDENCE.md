# Evidence

## Experiments

### A CLI stopped right after its first message keeps no transcript

The quit decision in `DECISIONS.md` closes a new session only once Claude Code starts replying, based on this experiment.

- Date: 2026-11-11. Version: Claude Code 2.1.322, the pinned one, on macOS.
- Method: a Bun script spawned `claude` with the adapter's `claudeSessionArgs` and `--session-id <new uuid>` in an empty folder, using the dev app's Claude config folder, waited for the `spawn` event as `backend.start` does, wrote one user message line, then ended stdin and sent SIGTERM, and checked the config folder's `projects/` for `<uuid>.jsonl`. It ran twice sending SIGTERM at once, and once sending it after the first stdout chunk holding a `stream_event` or `assistant` line.
- Result: stopped at once, both runs left no transcript (the config folder had no `projects/` at all); stopped after the first reply output, the transcript existed.

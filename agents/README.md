# agents

Tooling for the coding agents that work on this repository. None of it ships with the product apps.

- `skills/`: the skills, reached through the `.claude/skills` and `.agents/skills` symlinks. The root `AGENTS.md` says when each applies.
- `chats/chats.ts`: `upload claude|codex` copies a session's transcript to the private `alliance-agent-chats` S3 bucket, `fetch <key>` streams one back, and `check` warns the user and the agent when the keys are missing. It runs on bun, which the repository already needs. The hooks in `.claude/settings.json` and `.codex/hooks.json` run it at session start, after every turn, before compaction, and at session end. `skills/provenance/SKILL.md` says how a task lists its sessions and how to read a transcript.
- `hooks/block-pkill.sh`: a Bash `PreToolUse` hook, in both `.claude/settings.json` and `.codex/hooks.json`, that denies `pkill`, `killall`, any pgrep inside `$(…)` or backticks, and `pgrep … | xargs kill`, and tells the agent to find the PIDs with `pgrep -fl` first. It matches these anywhere in the command, so a command that only mentions them, such as `rg killall` or a commit message, is denied too.
- `desktop/`: Alliance agent, the Electron app employees work with coding agents through. `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/` holds its spec and PR plan. It is its own package, installed with `bun install` inside it after the root install, and imports nothing from outside the folder except `eslint/shared-rules.mjs`, whose own imports resolve from the root `node_modules`, and `common/src/result.ts`, so removing the app is deleting the folder plus the edits that spec lists and the removal edits recorded by later tasks naming that directory. `bun run dev` opens it; `bun run test` runs its bun unit tests, then builds it and runs its Playwright tests under Node, since Playwright can't launch Electron from Bun before 1.4.4 and its launch under 1.4.4 is untested on Linux. `.github/workflows/desktop.yaml` runs its typecheck and tests, outside `scripts/test-all.sh`. The Claude adapter's test stub, `src/main/agent/claude/testing/stub-claude.ts`, replays captured CLI traffic, choosing the capture by its command-line arguments, and the adapter's captures live in `src/main/agent/claude/testing/captures/<version>/`.

## Trust the hooks in Codex

Run `/hooks` in a Codex session and trust the repository's hooks, and again whenever `.codex/hooks.json` changes. Codex skips new or changed hooks until then, `block-pkill.sh` included. In a worktree, Codex runs the main checkout's `.codex/hooks.json` and the scripts it names, not the worktree's, so a worktree gets each hook only while the main checkout's branch has it.

## Set up uploads, once per machine

Add the `alliance-agent-chats` IAM user's keys to `.env.devtools` at the repository root, the gitignored file that already holds the Linear and PostHog keys. `scripts/new-worktree.sh` copies it into every new worktree; add the keys to each existing worktree's copy too.

```
AGENT_CHATS_AWS_ACCESS_KEY_ID=...
AGENT_CHATS_AWS_SECRET_ACCESS_KEY=...
```

Whoever runs terraform reads the two values with `terraform -chdir=terraform output -raw agent_chats_access_key_id` and `agent_chats_secret_access_key`; anyone else asks them.

Both CLIs run `chats.ts check` at session start, which warns the user and tells the agent when the keys are missing; the agent repeats it when it lists its session in a task's `SESSIONS.md`. A failed upload shows as a failed hook in a Codex session, but in Claude Code only as the session ends, since its per-turn uploads run in the background, where a failure shows nothing. `bun agents/chats/chats.ts fetch claude/none.jsonl` checks the keys against the bucket: `NoSuchKey` means they work.

Anyone without the keys, such as an outside contributor, sets `ALLIANCE_AGENT_CHATS=off` in their shell environment to skip the uploads and the warning.

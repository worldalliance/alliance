# agents

Tooling for the coding agents that work on this repository. Nothing here ships with the apps.

- `skills/`: the skills, reached through the `.claude/skills` and `.agents/skills` symlinks. The root `AGENTS.md` says when each applies.
- `chats/chats.ts`: `upload claude|codex` copies a session's transcript to the private `alliance-agent-chats` S3 bucket, `fetch <key>` streams one back, and `check` warns the user and the agent when the keys are missing. It runs on bun, which the repository already needs. The hooks in `.claude/settings.json` and `.codex/hooks.json` run it at session start, after every turn, before compaction, and at session end. `skills/provenance/SKILL.md` says how a task lists its sessions and how to read a transcript.

## Set up uploads, once per machine

Add the `alliance-agent-chats` IAM user's keys to `.env.devtools` at the repository root, the gitignored file that already holds the Linear and PostHog keys. `scripts/new-worktree.sh` copies it into every new worktree; add the keys to each existing worktree's copy too.

```
AGENT_CHATS_AWS_ACCESS_KEY_ID=...
AGENT_CHATS_AWS_SECRET_ACCESS_KEY=...
```

Whoever runs terraform reads the two values with `terraform -chdir=terraform output -raw agent_chats_access_key_id` and `agent_chats_secret_access_key`; anyone else asks them.

Codex only: run `/hooks` in a session and trust the repository's hooks. Codex skips them until then. In a worktree, Codex runs the main checkout's `.codex/hooks.json` and `agents/chats/chats.ts`, not the worktree's, so a worktree uploads only while the main checkout's branch has them.

Both CLIs run `chats.ts check` at session start, which warns the user and tells the agent when the keys are missing; the agent repeats it when it lists its session in a task's `SESSIONS.md`. A failed upload shows as a failed hook in a Codex session, but in Claude Code only as the session ends, since its per-turn uploads run in the background, where a failure shows nothing. `bun agents/chats/chats.ts fetch claude/none.jsonl` checks the keys against the bucket: `NoSuchKey` means they work.

Anyone without the keys, such as an outside contributor, sets `ALLIANCE_AGENT_CHATS=off` in their shell environment to skip the uploads and the warning.

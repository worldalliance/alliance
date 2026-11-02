# agents

Tooling for the coding agents that work on this repository. Nothing here ships with the apps.

- `skills/`: the skills, reached through the `.claude/skills` and `.agents/skills` symlinks. The root `AGENTS.md` says when each applies.
- `chats/sync.sh`: uploads a Claude Code or Codex session's transcript to the private `worldalliance-agent-chats` S3 bucket. The hooks in `.claude/settings.json` and `.codex/hooks.json` run it after every turn, before compaction, and at session end. `skills/provenance/SKILL.md` says how a task lists its sessions and how to read a transcript.

## Set up uploads, once per machine

1. Install the AWS CLI and jq.
2. Store the `alliance-agent-chats` IAM user's keys in a profile of the same name. Whoever runs terraform passes them from its output, so the secret never prints; anyone else asks them.

   ```bash
   for key in access_key_id secret_access_key; do
     aws configure set "aws_$key" "$(terraform -chdir=terraform output -raw "agent_chats_$key")" --profile alliance-agent-chats
   done
   aws configure set region us-west-2 --profile alliance-agent-chats
   ```

3. Codex only: run `/hooks` in a session and trust the repository's hooks. Codex skips them until then. In a worktree, Codex runs the main checkout's `.codex/hooks.json` and `agents/chats/sync.sh`, not the worktree's, so a worktree uploads only while the main checkout's branch has them.

Claude Code warns at session start when the profile or jq is missing. A failed upload shows as a failed hook in a Codex session, but in Claude Code only as the session ends, since its per-turn uploads run in the background, where a failure shows nothing. `aws s3 ls s3://worldalliance-agent-chats/ --profile alliance-agent-chats` checks the profile.

Anyone without the keys, such as an outside contributor, sets `ALLIANCE_AGENT_CHATS=off` in their shell environment to skip the uploads and the warning.

---
user: Charles Lien
task: Archive agent chat transcripts and link them from provenance
---

# Requirements

- Every Claude Code and Codex session run inside this repository, worktrees included, has its raw transcript stored in a private object-store bucket provisioned in `terraform/`. The bucket is the only store; a git repository or shared drive is ruled out, and transcript content never enters this open-source repository. (User-originated; the bucket itself is agent-proposed, user-approved.)
- Capture goes through hooks the two CLIs read from the repository, with no wrapper around the agents. (Agent-proposed, user-approved.)
- The only committed script is the transcript hook, `agents/chats/chats.ts`, kept simple: it uploads, fetches a raw transcript, and checks setup, but parses none. Agents read a transcript by filtering it with their own ad hoc parser in `.scratch/`, such as a `jq` filter; the repository ships no transcript reader. (User-originated.)
- Each task's provenance directory holds a `SESSIONS.md`, one bullet per session as `- claude:<uuid>` or `- codex:<uuid>`, appended by the agent itself rather than by a hook. Linking is per task: commits carry no session or provenance trailer. Read-only sessions are stored and referenced by nothing. (Agent-proposed, user-approved.)
- No CI check enforces `SESSIONS.md`, because the repository has no provenance check to attach one to. (User-originated.)
- CI has no access to the bucket. (Agent-proposed, user-approved.)
- Secrets inside stored transcripts are acceptable. (User-originated.)
- Agent infrastructure lives under a top-level `agents/` directory: skills move to `agents/skills/`, the upload hook lives in `agents/chats/`. (User-originated.)
- Per-person setup is adding the bucket's two keys to `.env.devtools`, the gitignored file that already holds developer tool keys; nothing else to install or configure beyond what the repository already needs. (User-originated.)
- When uploads are not set up on a machine, the agent says so to the user at the point it appends its session to the task's `SESSIONS.md`. (User-originated.)
- How those keys reach the bucket client is left to the agent. (User-deferred.)

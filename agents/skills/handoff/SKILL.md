---
name: handoff
description: Read when the user asks to hand the task to a fresh agent, as `/handoff` does, or to continue from a handoff, as `/handoff continue` or "read .scratch/HANDOFF.md and continue" do.
---

# Handoff

The user clears an agent's context by starting a fresh agent on the same task in the same directory. The fresh agent starts with only `.scratch/HANDOFF.md` and the repository, so the file holds what it needs that the repository doesn't. A good handoff lets it take the next step without asking the user anything already settled or redoing work already done.

A request to continue from a handoff goes to **Continue**; any other goes to **Write**.

## Write

Stop at the next stopping point instead of starting the next unit of work, such as a review round or a commit. Let a running command, background task or subagent finish and take in its result first, since background shells end with the session. A process meant to outlive the session, such as a dev server, stays running.

Bring the task's provenance up to date before writing, so requirements and decisions live there and the file points to them instead of repeating them.

Write `.scratch/HANDOFF.md` in the directory this session started in, which is where the user starts the fresh agent, even when the work happens in a worktree. A file already there that no session has marked continued may belong to a task still waiting on it: read it, and ask the user before overwriting one that might.

The file records the present state, not the session's story:

- This session, as `claude:$CLAUDE_CODE_SESSION_ID` or `codex:$CODEX_THREAD_ID`, so the reader can fetch its transcript per `(root)/agents/skills/provenance/SKILL.md` **Transcripts** when the file falls short.
- When it was written, the directory the work happens in, its branch and HEAD commit, and its uncommitted changes, so the reader can tell whether the repository has moved since.
- The task as the user set it, the Linear issue it claims if any, and its provenance directory.
- The skills in use and where the work stands in each, such as which review-loop round finished and what is due next.
- What is done and how it was verified: commands and results.
- The next step, concrete enough to start on, and what remains after it.
- Questions put to the user and their answers, or that they are still unanswered, and how-to-work instructions the user gave that provenance doesn't hold, such as not to push yet.
- Approaches tried and abandoned, with why, so they aren't retried.
- Processes left running, with PIDs, ports and the command that starts each, since one started from a session's background shell ends with it.
- The `.scratch/` files the work depends on, such as logs, prompts and subagent output.

Redact it per the root `AGENTS.md` **Secrets and personal information**. Then tell the user it is ready, and that `/handoff continue` (Claude Code) or `$handoff continue` (Codex) in a fresh agent started in this directory picks it up.

## Continue

Read `.scratch/HANDOFF.md`, then check it against the directory the work happens in, which it records: that directory's branch, HEAD and uncommitted changes. A mismatch, such as new commits, means the file may describe another task or a past state, so tell the user what differs before acting. Work in that directory; when it is a worktree, read its `.worktree/AGENTS.md` first, since its ports and databases replace the ones in your context. Restart, with its recorded command, any process the file lists that has ended.

Read the provenance directory and skills the handoff names, then take the next step it records. Its record of verified work stands without rerunning; where it is thin or contradicts the repository, fetch the previous session's transcript before asking the user.

Once you take the task, add `Continued by` and this session, in the form the file uses for its own, as the file's first line. Leave the file where it is; the next handoff overwrites it.

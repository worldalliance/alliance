# Decisions

- The skill is model-invocable, with a root `AGENTS.md` pointer, so a plain-language request to continue from the handoff finds it as well as `/handoff`. (agent decision)
- The chat ID is written as `claude:<id>` or `codex:<id>`, the form `SESSIONS.md` uses, so the continuing agent can fetch the previous transcript with `agents/chats/chats.ts` when the file falls short. (agent decision)
- The file records branch, HEAD and uncommitted changes, and the continuing agent checks them against the repository and tells the user about a mismatch, since the fixed path means a stale handoff from an earlier task could otherwise be continued silently. (agent decision)
- The writer brings provenance up to date first and points to it, keeping requirements and decisions in one place. (agent decision)
- Before overwriting a handoff from another session, the writer asks the user when that handoff's task may still be waiting on it, since two tasks can share a checkout. (agent decision)
- The continuing agent marks the file `Continued by <session>` on its first line, and the writer overwrites a marked file without asking, so a consumed handoff doesn't look like one still waiting. (agent decision)
- When the work is in a worktree, the continuing agent reads that worktree's `.worktree/AGENTS.md`, since it starts in the directory the handoff was written in, usually the main checkout, with that checkout's ports in context. (agent decision)
- The continuing agent leaves the file in place; the next handoff overwrites it. (agent decision)
- The file records the command that starts each process left running, and the continuing agent restarts one that has ended instead of reporting it as a mismatch, since a dev server started from a session's background shell ends with that session. (agent decision)

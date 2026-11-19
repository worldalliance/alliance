---
user: Charles Lien
task: Create a handoff skill, where the agent stores enough context for a fresh agent to continue the task
---

# Requirements

- A `handoff` skill has the agent write `.scratch/HANDOFF.md` describing the current progress on the task, for a new agent with fresh context that reads only that file and has access to the same directory. (user-originated)
- `/handoff continue` in a fresh chat, or another request to continue from the handoff such as "read .scratch/HANDOFF.md and continue", has the agent read the file and continue where the previous agent left off. (user-originated)
- The handoff records the session's chat ID. (user-originated, offered as a suggestion)
- Before writing, the agent gets to a stopping point rather than starting the next round of work, such as the next round of reviews, and lets a command or background task that is running finish. (user-originated)

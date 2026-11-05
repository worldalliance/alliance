---
user: Charles Lien
task: Stop coding agents from killing processes by pattern, after an agent's `pkill -TERM -f "bun src/main.ts" -n` matched and killed every Claude session, cmux terminal shell, and Chrome/Slack helper on the machine.
---

- A `PreToolUse` hook on Bash blocks `pkill` and `killall` for both Claude Code and Codex. (Agent-proposed, user-approved.)
- The hook also blocks pgrep output passed straight to a kill: `$(pgrep`, a backticked pgrep, and `pgrep … | xargs … kill`. (Agent-proposed, user-approved.)
- The hook blocks only those forms and `pkill`/`killall`. Blocking any further command or form is out of scope for this task. (User-originated.)
- The hook's denial message tells the agent to list the candidates with `pgrep -fl '<pattern>'`, options before the pattern because anything after it is another pattern, check that every listed process is one it means to stop, and then `kill <pid>`. (User-originated: find the PID first, so the agent can catch a bad match before anything is killed.)
- The root `AGENTS.md` "Stopping processes" section carries the same find-first step for a process whose PID the agent does not have. (Agent-proposed, user-approved.)

---
name: subagents
description: Read before spawning a subagent.
---

# Subagents

Spawn every subagent through one of these CLIs from the shell, in place of your harness's built-in agent tool. Write the prompt to a file in `.scratch/` with your file-writing tool or a quoted heredoc (`<<'EOF'`) and pass it on stdin, so the shell can't expand backticks or `$` in it. Send the event stream to a log, not your context, and run the command in the background with your harness's longest time limit, since a subagent can outlast a foreground timeout. A shell tool with no background mode runs it in the foreground with its longest timeout instead; a detached `&` there gets killed when the tool call returns. Pick a `<name>` no earlier run used, so no file below is left over from one, and run from the repo root, since the paths are relative:

```bash
REVIEW_LOOP_ROLE=subagent CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=7200000 claude --dangerously-skip-permissions -p --output-format=stream-json --verbose < .scratch/<name>-prompt.md > .scratch/<name>.jsonl 2> .scratch/<name>.err; echo $? > .scratch/<name>.exit
REVIEW_LOOP_ROLE=subagent codex exec --dangerously-bypass-approvals-and-sandbox --json -o .scratch/<name>-out.md - < .scratch/<name>-prompt.md > .scratch/<name>.jsonl 2> .scratch/<name>.err; echo $? > .scratch/<name>.exit
```

`REVIEW_LOOP_ROLE` keeps the subagent out of the review loop, which needs the user. `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` raises how long `claude -p` waits on its background tasks after its last turn, from 10 minutes to two hours. A background shell ends at its own `timeout`, so a prompt for a long task such as a check run asks for a long `timeout`. `claude -p` refuses `stream-json` without `--verbose` unless the user's settings turn it on. For a task that must not write, such as a second opinion, pass codex `-s read-only` in place of `--dangerously-bypass-approvals-and-sandbox`, or claude `--permission-mode plan --disallowedTools Bash` in place of `--dangerously-skip-permissions`, since plan mode still runs the Bash commands any settings file or `--allowedTools` allows, such as `bun run build`.

## When a CLI isn't set up

Many people have only one of the two subscriptions. `codex login status` and `claude auth status` exit nonzero when that CLI isn't logged in, and fail outright when it isn't installed. A step that asks for a CLI that isn't set up, such as `consult`'s second opinion or the codex subagent of the root `AGENTS.md` **File size**, runs the CLI this machine has instead. A step that pairs the two vendors, such as a Claude and a Codex reviewer on one commit, runs only the one this machine has, once. Either way, tell the user once per session which CLI isn't set up, so they know what ran in its place or ran alone.

## Reading the result

The run is done once `.scratch/<name>.exit` exists. A nonzero code, or a command that ended without writing `.exit` because a time limit killed it, means it failed: read `.scratch/<name>.err` and the end of the `.jsonl`. Otherwise the answer is `jq -r 'select(.type=="result").result' .scratch/<name>.jsonl` for claude, or `.scratch/<name>-out.md` for codex.

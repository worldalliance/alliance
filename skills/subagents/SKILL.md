---
name: subagents
description: Read before spawning a subagent.
---

# Subagents

Spawn every subagent through one of these CLIs from the shell, in place of your harness's built-in agent tool. Write the prompt to a file in `.scratch/` with your file-writing tool or a quoted heredoc (`<<'EOF'`) and pass it on stdin, so the shell can't expand backticks or `$` in it. Send the event stream to a log, not your context, and run the command in the background with your harness's longest time limit, since a subagent can outlast a foreground timeout. A shell tool with no background mode runs it in the foreground with its longest timeout instead; a detached `&` there gets killed when the tool call returns. Pick a `<name>` no earlier run used, so no file below is left over from one, and run from the repo root, since the paths are relative:

```bash
claude --dangerously-skip-permissions -p --output-format=stream-json < .scratch/<name>-prompt.md > .scratch/<name>.jsonl 2> .scratch/<name>.err; echo $? > .scratch/<name>.exit
codex exec --dangerously-bypass-approvals-and-sandbox --json -o .scratch/<name>-out.md - < .scratch/<name>-prompt.md > .scratch/<name>.jsonl 2> .scratch/<name>.err; echo $? > .scratch/<name>.exit
```

## Reading the result

The run is done once `.scratch/<name>.exit` exists. A nonzero code, or a command that ended without writing `.exit` because a time limit killed it, means it failed: read `.scratch/<name>.err` and the end of the `.jsonl`. Otherwise the answer is `jq -r 'select(.type=="result").result' .scratch/<name>.jsonl` for claude, or `.scratch/<name>-out.md` for codex.

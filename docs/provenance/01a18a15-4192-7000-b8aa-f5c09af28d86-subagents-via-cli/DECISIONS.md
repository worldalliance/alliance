# Decisions

Experiments below ran against `claude` 2.1.312 and `codex-cli` 0.163.0, from Claude Code's Bash tool unless they name another parent.

- The rule is a pointer line in the root `AGENTS.md` Skills list, and the commands, readout, and failure handling live in `skills/subagents/SKILL.md`. The root file loads every turn and holds rules, not procedures (`skills/writing-for-agents/SKILL.md`).
- The prompt goes in a `.scratch/` file, written with a file-writing tool or a quoted heredoc, passed on stdin (`codex exec … -` reads it from there). Single quotes would break on apostrophes, and an unquoted heredoc expands the body while writing it. The user left this choice to the agent.
  - A double-quoted argument runs backticked paths and expands `$`: ``zsh -c 'printf "%s\n" "Read `server/AGENTS.md` and report $HOME"'`` printed `permission denied: server/AGENTS.md`, then `Read  and report [home]`. The scripts in `scripts/` are executable, so a backticked one would run.
  - Through stdin, a prompt of ``Reply with exactly: OK `x` $HOME`` came back verbatim from both CLIs.
  - Stdin from a file also gives codex an EOF: `sleep 40 | codex exec … "Reply with the single word OK."` took 46s, against 12s with `< /dev/null`.
- Each command writes its event stream to `.scratch/<name>.jsonl` and the parent reads back only the final answer (`jq` on claude's `result` event, codex's `-o` file).
  - A no-tool `Reply with exactly: OK` produced 8,349 bytes over 6 claude events (hook, init listing every tool and MCP server, assistant, result) and 705 bytes of codex JSONL. A real run adds a `tool_result` event per read.
- Each command writes its exit code to `.scratch/<name>.exit`. A nonzero code or a missing `.exit` means failure; the `result` text and `-o` file can't be trusted on their own.
  - `--max-turns 1` on a prompt needing a tool: claude exited 1, `{"subtype":"error_max_turns","is_error":true,"result":null}`, so the `jq` printed `null`.
  - `--model nonexistent-model-x`: claude exited 1 with `"is_error":true` and a `result` holding the error message, which the `jq` prints like an answer.
  - `-m no-such-model`: codex exited 1 with `turn.failed` and left an `-o` file seeded with `STALE` untouched.
  - In-stream markers can't replace the exit code: a run still streaming has only leading events (`thread.started`, `turn.started`; `system`, `assistant`), with no failure marker, and would read as done.
- Each run takes a fresh `<name>`, because a failed codex run leaves an earlier `-o` file in place and an old `.exit` would mark an unfinished run done.
- Stderr goes to its own `.err` file. Merging it into the `.jsonl` would break the `jq` readout.
  - Failures before streaming reach only stderr: codex with `-C /nonexistent-dir` and claude with `--bogus-flag` each exited 1 with a 0-byte `.jsonl`, and stderr held `No such file or directory (os error 2)` and `unknown option '--bogus-flag'`.
- The commands run in the background with the harness's longest time limit, since a subagent can outlast a foreground timeout and Claude Code's default background limit equals its foreground maximum (600000 ms, from its Bash tool contract).
  - A time limit kills the whole line before `echo $?` runs: `sleep 120 …; echo $? > t4.exit` backgrounded with a 60000 ms limit was killed and left no `t4.exit`. Hence a missing `.exit` counts as failure.
- A shell tool with no background mode runs the command in the foreground with its longest timeout instead.
  - With codex as the parent, `( sleep 10 …; echo $? > a.exit ) &` and `nohup bash -c '…' > /dev/null 2>&1 < /dev/null &` were both killed once the tool call returned, though codex kept running 20s more. Only a process in a new session (`subprocess.Popen(…, start_new_session=True)`) survived, so codex kills the tool call's process group.
  - A trailing `&` on the documented line backgrounds only the `echo`: `sleep 3 …; echo $? > t5.exit &` returned after 3s.
- The commands run from the repo root, since their paths are relative.
  - Run from `server/`, the claude command printed `no such file or directory` for both the prompt and `.exit`, and left neither `.err` nor `.exit`.
- The File size rule's read-only codex request points at the subagents skill and swaps in `-s read-only`, so the repo names one way to spawn codex.
  - `codex exec -s read-only --json -o … - < prompt` exited 0 with the answer in the `-o` file, and refused a write without hanging.
- The `--output-format` value is `stream-json`, the only streaming value `claude` accepts; `json-stream` errors out. It needs no `--verbose`: `claude -p --output-format=stream-json "say hi"` streamed events without it.

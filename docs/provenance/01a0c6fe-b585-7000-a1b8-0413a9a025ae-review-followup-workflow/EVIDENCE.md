# Evidence

Codebase state: HEAD 5985006099ed40b0265468db60d13e6440804940 plus the working-tree changes for this task. Commands below run from the repository root unless a different directory is stated.

- Read agentic-workflows/src/workflows.ts and README.md. The existing workflow resolves a base SHA, deletes .scratch, then launches Claude; it has no Codex step.
- Ran `codex --help`, `codex exec --help`, and `codex exec resume --help` from the repository root; all exited 0. The installed CLI provides non-interactive JSON output and session-specific resume. Approval policy is a top-level option.
- Read https://learn.chatgpt.com/docs/non-interactive-mode. Its examples document thread.started, item.completed agent messages, turn.completed, and resuming an explicit session ID.
- Initial `bun test` in agentic-workflows timed out waiting for fake agent output and was interrupted. A separate Bun experiment changed process.env.PATH to include a newly created executable; Bun.which returned null and Bun.spawn reported ENOENT. After switching test executable resolution to absolute paths, `bun test` in agentic-workflows exited 0: 11 tests passed with 50 assertions.
- Initial `bun run typecheck` in agentic-workflows exited 2 because test.each supplied readonly event arrays to a mutable-array parameter. After correcting the parameter to readonly, the command exited 0.
- Both launch forms, initial and explicit-session resume, accepted the requested sandbox and approval flags plus --model and --json when invoked with --help; exit status 0. No live Codex review was launched.
- Final `bun test` from agentic-workflows exited 0: 11 tests and 50 assertions passed. Cases cover session-specific resume, step-mode pauses, archive retention before scratch deletion, archive failure preserving scratch, missing or mismatched review input, failed or truncated Codex output, nonzero process exit, and required human action after independent fixes.
- Final `bun run typecheck` from agentic-workflows exited 0.
- Rendered Transcript with React's renderToStaticMarkup using two synthetic Codex events: an item.completed agent_message whose JSON report says "Add the service credential in GitHub.", and an item.started command_execution for "bun run typecheck". Both strings appeared in the rendered HTML; the Bun check exited 0.
- `bun run format:check agentic-workflows skills/review/SKILL.md skills/review-base/SKILL.md skills/review-base/findings.schema.json skills/review-followup/SKILL.md docs/provenance/01a0c6fe-b585-7000-a1b8-0413a9a025ae-review-followup-workflow` exited 0; all matched files passed formatting.
- After switching prompts to `$review-followup`, `bun test` from agentic-workflows exited 0 with 11 tests and 51 assertions, including exact prompt arguments received by the fake Codex executable. `bun run typecheck` from the same directory exited 0.

---
user: Charles Lien
task: Go with the build order and test strategy the research agents recommended for the Alliance agent desktop app's agent sessions
---

## Changes to the PR plan

This supersedes the "Depends on" column of the PR plan in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/DECISIONS.md` for these PRs (agent decision):

- ALL-2030 (Claude adapter) and ALL-2031 (Codex adapter) no longer wait for ALL-2029 (bundled CLIs). The thin path runs against installed CLIs at the pinned versions, since bundling is packaging work the path doesn't exercise. ALL-2029 then swaps in the bundled binaries.
- ALL-2032 (chat UI) starts as the minimal UI the thin path needs and widens after the path works on both CLIs. It no longer builds against the fake first.
- The path covers both CLIs because their protocols differ (stream-json against JSON-RPC), so one CLI alone wouldn't show whether the interface is vendor-neutral.

## Claude's command

The command in that task's "Agent processes" section omits `--include-partial-messages`. Without the flag, assistant text arrives in whole blocks, so the thin path's streamed text needs it (agent decision; see EVIDENCE.md).

## What comes back from PR #923's branch

PR #923 was closed on 2026-11-06 and now conflicts with `main`, so the work returns on a fresh branch rather than by reopening it (agent decision). The PR's commits come back in their original order, each kept as its own commit, with two exceptions: the commit adding the app's copy of `Result` does not come back, since the app imports `common/src/result.ts` instead, and the bun test setup joins the listener dispatcher commit, the first with a test for it to run. The dispatcher's and fake's tests build on that setup, it needs the root test lists narrowed, and the narrowing edits files the earlier commits created: `f9fe7812bd` adds the task's provenance directory, and `4aaac93e0f` adds `scripts/test-all.test.ts`. The Commercial Terms record (`13b326d8b1`) comes too, so `main` stops listing that question as unanswered. Where `agents/README.md` conflicted, `main`'s wording on removing the app stands, with the bun test edits applied to it. The `citesting` unit-test job runs on `ubuntu-24.04`, because Playwright 1.59.1 refuses `ubuntu-latest` (26.04); `deploy.yaml` already pins that runner for its `visual-regression` job.

`main` gained tests under `agents/skills` after that branch narrowed the root test lists to `agents/hooks`, so `scripts/test-all.sh` and the `ci.yaml` and `deploy.yaml` test matrices now list `agents/skills` too, which `scripts/test-all.test.ts` requires.

Known gaps in the restored interface, assumed from the transcript review of the PR #923 sessions and unverified against the real CLIs: `start` takes only `cwd`, so the model and effort picker needs another parameter; sessions have no `close()`, deferred to ALL-2090, which ALL-2035 and ALL-2036 need; and `--session-id`, text block shape and interrupt behaviour come from reading vendor docs. The thin path checks the last group.

## Stub endpoint tier

The stub tier stays conditional because neither vendor documents base-URL overrides for test stubs, and it means emulating two wire protocols. If a pinned CLI can't finish a turn against a stub without a login, that tier drops for that CLI, leaving captures and live runs (agent proposal, from the research).

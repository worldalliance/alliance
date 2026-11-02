# Cost of the manual review loop

Measured on 2026-10-30 from Claude Code transcripts in `~/.claude/projects/`, by four read-only audit agents (three `claude -p`, one `codex exec`); the Claude and Codex totals for the first two runs agree within 1%. Costs are API-equivalent dollars from the transcripts' own usage records ($0.20/M cache read, $8/M one-hour cache write, $20/M output). The team runs on subscription usage, so the dollars are relative weights; they compare Claude sessions with each other, not with Codex.

Method: usage counts once per assistant `message.id`, since a response's events repeat; "context" is input + cache read + cache write for one request; a child `claude -p` session's cost is its own transcript's usage, or the last cumulative `result` event of its stream.

## Runs

Each run reviewed every commit in `<remote>..<local>` with `/review-base` in its own worktree, fixed fix-now findings, and repeated until a round came up clean, or until task-flow's last fix-now finding was waiting on a question to the person.

|                            |                     normalized-entities (PR #873) |         task-flow (PR #820) | agent-workflow-specs (PR #874) |
| -------------------------- | ------------------------------------------------: | --------------------------: | -----------------------------: |
| Orchestrator session       |                                        `3673c18a` |                  `e661339b` |                     `b5ba8c79` |
| Fixer shape                | one session, `--resume`d every round (`0dda8348`) | fresh `claude -p` per round |    fresh `claude -p` per round |
| Rounds                     |                                                 9 |                          10 |  27, plus 3 after a CI failure |
| Reviewer runs              |                                                43 |                         121 |                             95 |
| Orchestrator               |                                   $1.7 (peak 69K) |            $3.5 (peak 114K) |               $4.4 (peak 147K) |
| Fixer tier                 |                                 $12.5 (peak 311K) |           $46.4 (peak 272K) |    $57.7 (peak 164K, mean 95K) |
| Reviewers                  |                                             $37.4 |                      $117.3 |                         $105.2 |
| Total                      |                                              ~$52 |                       ~$167 |                          ~$167 |
| Per round                  |                                              $5.7 |                       $16.7 |                           $5.6 |
| Fixer per round            |                                             $1.39 |                       $4.64 |                          $1.92 |
| Review spend after round 1 |                                               87% |                         83% |                            95% |

Fix-now findings per round, from each run's ledger: task-flow 37, 30, 18, 15, 13, 7, 7, 6, 3, 1, of which 2, 0, 0, 2, 1, 1, 2, 1, 0, 1 waited on a question to the person, so its fixer fixed 35, 30, 18, 13, 12, 6, 5, 5, 3, 0; agent-workflow-specs 11, 7, 7, 6, 6, 5, 4, 6, 7, 7, 7, 3, 2, 2, 2, 1, 1, 2, 1, 1, 1, 2, 2, 3, 1, 1, 0. Two runs reached a clean round; task-flow ended with its last fix-now finding waiting on a question to the person. Later rounds found real defects (concurrency bugs among them) as well as wording nits in fresh reviews of rewritten commits. In agent-workflow-specs one commit at a time held up the rest of the branch, and commits stacked on a rewritten one were sometimes re-reviewed unchanged.

Before the delegated runs, the same normalized-entities branch had run 8 rounds and 38 reviewers in one session (`8619b8aa`): orchestrator $24.4 at a 487K peak, ~$60 in total.

## Where a round's cost goes

- **Reviewer, ~$1 per run** ($0.87, $0.97, $1.11 by run): about half cache writes, a third output. A reviewer reaches the diff at a median 27K context, after the system prompt, `AGENTS.md`, skill and tool lists, `/review-base`, `agents/skills/review/SKILL.md` and the findings schema. That startup is $0.15 per run, 15% of reviewer cost; the rest is exploring the code (mean peak 76K).
- **Fixer**: resuming one session grew its context 65K → 101K → … → 311K over nine rounds; a fresh session per round would have read ~9.8M cached tokens instead of 36.8M (~$5 of $12.5). Fresh sessions were not automatically cheap: task-flow's round-1 fixer reached 266K from check output and findings, and one left a `Monitor` running that woke it 14 times at ~266K each.
- **Fixer waiting**: agent-workflow-specs fixers polled reviewers with `pgrep`/`sleep` loops, each poll re-reading 30–60K context: $3.3.
- **Orchestrator**: grows with accumulated round summaries; $0.15 per round in agent-workflow-specs.

## Local checks

From 45 sessions (all three orchestrators and every fixer), 572 check calls:

| Check                                            | Runs | Tool output tokens | Output cost | Turn cost |
| ------------------------------------------------ | ---: | -----------------: | ----------: | --------: |
| unit tests                                       |  313 |              36.7K |       $3.24 |    $14.76 |
| per-commit loops (`rebase -x`, `rev-list` loops) |   82 |              10.8K |       $0.91 |     ~$3.4 |
| format                                           |   52 |              11.6K |       $0.57 |     $2.41 |
| typecheck                                        |   48 |               6.3K |       $0.53 |     $2.00 |
| covercheck                                       |   25 |               6.4K |       $0.38 |     $0.89 |
| dupcheck                                         |   18 |               3.9K |       $0.16 |     $0.69 |
| other                                            |   34 |               6.7K |       $0.32 |     $1.37 |
| total                                            |  572 |                82K |       ~$6.1 |    ~$25.5 |

Tool output tokens count the check results. Output cost is what a result costs: its tokens written to cache, re-read by every later request, plus the response that reads it. Turn cost is the full cost of the response that made the call, which re-reads the whole context.

97% of calls already piped output through `tail`/`grep`/`head` or to a log; the median result was 87 tokens. Cutting output to one line per check plus a failure's tail would have saved ~$0.9. The cost is the number of turns: 258 check turns came straight after another check turn, and merging those into one call would have saved up to ~$10. Fixers also spent turns writing and patching their own per-commit check scripts. `test:e2e` and actionlint never ran.

## CI after push

| Run                  | Job                  | Cause                                                                                                                                                                   | Caught by local checks                                                          |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| task-flow            | wikicheck (twice)    | CI tests the branch merged into `main`; `main` had just added wikicheck and the branch's new provenance directories lacked rows. Both failures predate the review loop. | No; local checks run on the branch, not the merge. wikicheck was later removed. |
| agent-workflow-specs | unit tests (scripts) | A test symlinked `sleep`; on the Linux runner coreutils is a multi-call binary, so the symlink exited immediately.                                                      | No; passes on macOS. A CI-fix agent and 3 more rounds fixed it.                 |
| normalized-entities  | —                    | All 11 workflow runs passed (1 CI, 1 seed-load, 9 commit review).                                                                                                       | —                                                                               |

CI checks these sessions' local runs didn't cover: the merge with `main`, Linux, `bun install --frozen-lockfile`, typecheck and unit tests across every package, repo-wide `format:check`, `test-backend-e2e`, `migrations-drift-check`, `seed-load-check`, `dirty-check`, `gitignore-check`, `mobile-fingerprint-check`, `test-unit (.github)`, pinned actionlint plus shellcheck, and `code-review.yaml`'s AI review on every push.

## The scripted loop reviewing itself

The branch that held `scripts/review-loop.sh` and `scripts/check.sh` ran the loop on itself, 2026-10-30 to 2026-11-01 (orchestrator session `5a8299ba-7425-40ef-b03a-4e698159a49f`): 25 rounds over 35 hours, ~$179 API-equivalent, and 203 fix-now, 5 follow-up and 7 dropped issues after dedup, tallied from the run's ledger, a local working file. It never reached a clean round: it stopped at round 25 when `shared/forms/timeZoneSelect.test.ts`, which the branch didn't touch, began failing as daylight saving ended, with that round's fixes unreviewed. The branch reached 3,757 added lines: 840 of scripts, 2,516 of tests and fixtures, 333 of prose and 68 of schemas, config and lockfile. About 90% of the findings in rounds 10–25 were about script robustness: signal handling, perl alarm limits on macOS, flock scope, git path quoting, untested guards. The loop broke twice on itself: a fixer's status was lost when `claude -p` stopped its background task at the 10-minute limit, and a coverage process outlived its removed worktree. The orchestrator the script replaced had cost 2–3% of each measured run. The scripts and their tests were removed on 2026-11-01; `DECISIONS.md` has the reasoning.

## Verification

The scripts' tests as they stood before the scripts were removed. No branch or tag holds them: `2131b4b0d3`, the last commit with them, survives only in one machine's reflog, so this section is a record, not something to rerun.

`scripts/check.sh`, 2026-10-30:

- `scripts/check.test.ts` runs a copy in a temp repo, with `bun`, `actionlint`, `shellcheck`, `test-all.sh` and `format.sh` stubbed. It covers package selection for `shared`, `sharedweb`, `common` and `scripts/` changes; a failure's tail, log path and exit 1, with later checks still running; formatting only files that still exist, and no symlinks; React Router typegen before typecheck; non-ASCII paths, new and modified, and paths git quotes; a check past the time limit failing and its descendants stopping, signals reaching them, a signal to check.sh alone stopping the run and the check, and exit 2 for a bad limit, an unresolved `origin/main` and an unknown argument; when actionlint and shellcheck run, on a composite action's edit too, with each commit's own shellcheck list, on an edit to that list, and failing when the list is missing; dupcheck findings as a `note` and a failed scan as `FAIL`; a package in no list stopping the run; and a branch with no changes running no format. A move out of `common` checks `common`'s consumers. Signals sent while the wrapper still ignores them stop the run too. A signal ignored on entry leaves the check to its limit, and a process that survives the first signal gets another, then KILL after 5 seconds. Under 8 CPU burners and 12 parallel loops the `still ignores` tests failed 4 of 60 runs with one forwarded signal, and 0 of 300 with the repeats, leaving no process behind.
- `scripts/check-commits.test.ts` covers `--commits` on the same fixture: checking each commit's own files, returning to the branch after a failure, after a check leaves the tree dirty, when a tag shares its name and after its output pipe closes, starting from a detached HEAD, failing when it can't return and saying when `bun install` is still owed, reinstalling on a lockfile change and on return and failing when that reinstall fails, a second signal during that reinstall saying it is owed, a signal stopping the run and the return still happening, checking a merge against its first parent, printing `nothing to check` for an empty commit, stopping when a commit's files can't be listed, and refusing uncommitted changes, untracked files and a single revision.
- On the working tree of the branch that held it, it ran 10 checks in 2m28s and printed 22 lines. Its one failure was real: common's ESLint pass over `scripts/` flagged an unused parameter in `scripts/check.test.ts` that `bun test` had passed.
- `--commits` across that branch's four commits took 9m52s. It found a real defect in itself: it kept CI's shellcheck list in the running copy, so at the commit adding `scripts/check.sh` it shellchecked `scripts/review-loop.sh`, which only a later commit adds.

`scripts/review-loop.sh`, 2026-10-30, with `claude` and the worktree scripts stubbed; no real reviewer or fixer ran:

- `scripts/review-loop-*.test.ts` covers: one worktree per commit at the round's tip, all removed with their branches; finishing clean with no fixer when nothing is found; re-reviewing only commits whose diff changed, skipping a message-only rewrite (under `color.ui=always` too) but not a whitespace-only one, re-reviewing an unchanged commit the fixer names, and reviewing a diff a later fix restores; pausing on questions with exit 3 until an answers file exists, then a second pass briefed with both files; a failed review exiting 1 with its worktree removed, and a rerun retrying only that review; schema-invalid findings, an empty summary, and rejected findings kept until a passing rerun; worktree setups never overlapping; SIGTERM during a reviewer's cleanup still removing its worktree; `--base` naming the branch itself refused; a worktree that can't be created; a round restarting after HEAD moved; a fixer that rewrites the base, leaves uncommitted changes, writes no or an invalid status, reports failing checks or names a commit outside the range; refusing to nest under `REVIEW_LOOP_ROLE`; using the upstream as the base; reviewing only the branch's commits when `origin/main` moved on after it forked; and SIGTERM mid-review, with more commits queued than run at once, exiting 143 with no queued review started and every worktree removed; a second run refusing to start while the first holds the lock, and a run refused for a dirty tree, both without replacing the saved base; a review surviving a failing `git worktree list`, and a setup that makes no worktree failing the review; a fixer that outlives a killed run keeping a rerun out, while what an agent leaves running holds nothing; SIGTERM stopping a running fixer; a relative `--base` staying on its commit after HEAD moves; a failing worktree list reported rather than leaking the worktree, at a reviewer's end and at the start of a run; a fixer that grows the script leaving the main process's exit alone; removing this checkout's reviewer worktrees while keeping another checkout's, and a run the lock refuses removing none; and a branch named with `/` and `&` keeping its own state and its name in the fixer prompt; reviewers and fixers starting with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=7200000`; a second run going ahead after git's fsmonitor daemon was started by the first; and a pushed branch no run has reviewed exiting 1, while one a run reviewed stays clean; an agent past its time limit failing the run, with a rerun retrying it; that limit and `SIGTERM` stopping what a fixer started; and a missing `jq` stopping the run before any agent starts. The tests clear `REVIEW_LOOP_ROLE` and that variable, so they pass, and still detect its loss, when a fixer runs them.
- Two defects the tests caught before commit: a `$(git rev-parse --short)` in the failure message reset `$?`, so a failed reviewer was reported as "claude exited 0"; and a rerun treated a fixer status that had failed validation as done. The second test fails with that loop condition restored.

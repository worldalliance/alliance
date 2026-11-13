# Decisions

## Earlier attempt replaced

Agent decision. This task first shipped five commits on the same branch (engineering-criteria checklists, rebase-affected re-reviews, repeat handling in the fixer, the split rule, and an experiment plan for focused review passes). Six review rounds elaborated them, mostly the parts whose design the owner had deferred, and the measurements in EVIDENCE.md showed reviewer coverage is the smallest share of loop time. The branch was rebuilt from `origin/main` around the changes in REQUIREMENTS.md; the earlier commits are not part of it. Linear issue ALL-2203, filed for that experiment plan, is left for the owner to close or repurpose.

## A fixer ends its run with its report

Agent decision on how; the user required the change and deferred how it is done (REQUIREMENTS.md). The fixer prompt tells the fixer to stop its background tasks, monitors and wakeups before its final message. The subagents skill runs `claude -p` with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` at two hours so a subagent's background checks can finish, and that same wait kept eight finished fixers alive for 2.6 hours (EVIDENCE.md, **Where review-loop time goes**). Lowering the ceiling instead would cut off fixers whose checks are still running. The review skill tells reviewers only to stop their background tasks, not monitors or wakeups; no reviewer was measured waiting this way, so reviewers are left as they are.

## Rounds go on without a continuation question

Agent decision on how; the user required the change and deferred how it is done (REQUIREMENTS.md). The loop already says rounds repeat with no cap, yet a hub asked whether to continue and waited 11.7 hours for "continue" (EVIDENCE.md, **Where review-loop time goes**). The rule now says outright that the hub doesn't stop between rounds to ask or to report, since a hub that ends its turn with a progress report waits for the user just the same; the questions the skill does send to the user, a fixer's questions, **`main` moved on** and the failures it names, are unchanged.

## At most four reviewers at a time

Agent decision on how; the user required the change and deferred how it is done (REQUIREMENTS.md). "A handful" left the number to each hub, and reviewers run end-to-end suites, typecheck and unit tests. Load averages of 800 and more on a 10-core machine appeared beside timing-test failures (EVIDENCE.md, **Where review-loop time goes**), recorded during fixer runs after that loop's own reviewers had finished, so the load came from other checkouts and the fixer's own checks, not from one loop's reviewers. Four is agent judgement: enough to keep reviews parallel on a branch's usual commit count while leaving cores for the fixer and other checkouts, and it bounds the worktree pool the next change keeps. Starting the next reviewer as one finishes, rather than in batches, keeps the slots full. This caps only one loop; loops on other branches still share the machine, and how much contention costs wasn't measured.

# Decisions

## Earlier attempt replaced

Agent decision. This task first shipped five commits on the same branch (engineering-criteria checklists, rebase-affected re-reviews, repeat handling in the fixer, the split rule, and an experiment plan for focused review passes). Six review rounds elaborated them, mostly the parts whose design the owner had deferred, and the measurements in EVIDENCE.md showed reviewer coverage is the smallest share of loop time. The branch was rebuilt from `origin/main` around the changes in REQUIREMENTS.md; the earlier commits are not part of it. Linear issue ALL-2203, filed for that experiment plan, is left for the owner to close or repurpose.

## A fixer ends its run with its report

Agent decision on how; the user required the change and deferred how it is done (REQUIREMENTS.md). The fixer prompt tells the fixer to stop its background tasks, monitors and wakeups before its final message. The subagents skill runs `claude -p` with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` at two hours so a subagent's background checks can finish, and that same wait kept eight finished fixers alive for 2.6 hours (EVIDENCE.md, **Where review-loop time goes**). Lowering the ceiling instead would cut off fixers whose checks are still running. The review skill tells reviewers only to stop their background tasks, not monitors or wakeups; no reviewer was measured waiting this way, so reviewers are left as they are.

## Rounds go on without a continuation question

Agent decision on how; the user required the change and deferred how it is done (REQUIREMENTS.md). The loop already says rounds repeat with no cap, yet a hub asked whether to continue and waited 11.7 hours for "continue" (EVIDENCE.md, **Where review-loop time goes**). The rule now says outright that the hub doesn't stop between rounds to ask or to report, since a hub that ends its turn with a progress report waits for the user just the same; the questions the skill does send to the user, a fixer's questions, **`main` moved on** and the failures it names, are unchanged.

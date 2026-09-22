---
name: review
description: Review the proposed change for correctness, maintainability, and risk.
disable-model-invocation: true
---

# Goal

High-signal review of the proposed change: catch correctness bugs, edge cases, and likely regressions; prevent quiet tech debt (duplication, inconsistent abstractions, fragile error handling); keep the change maintainable, testable, secure, and consistent with the codebase.

# Reviewer stance

- Ask when context is missing; say so when uncertain, and name the evidence that would settle it.
- Accept the author's choice among equally valid approaches.

# What to inspect

Read `(root)/skills/engineering-criteria.md`. Apply each relevant criterion to the change and use it when recommending fixes.

# Verify every claim

Start each review from the code and requirements. Keep prior reviews, review assessments, and agent-authored DECISIONS.md files out of the review context, including their contents in diffs. A later review is a fresh assessment, not a reconciliation with earlier verdicts.

Inspect every changed file and trace affected callers and contracts. Finish discovery before proposing repairs. Report every supported finding, including nits with a concrete benefit; there is no finding-count limit. Record completed verification and unchecked areas in the summary; for unavailable checks, name the blocker and the specific check or assistance needed. An incomplete review is not a clean review.

For each behavioral finding, identify the reachable trigger, expected and actual behavior, consequence, and supporting requirement or contract. Make the defect observable: run the input that breaks it, write a failing test, or trace the execution path to a real caller. Distinguish observed failures from unverified claims.

For cleanup, establish the concrete benefit and the assumptions that make it safe. Verify that dead code is unused and duplicated code implements the same rule. More accurate text and comments qualify; preference alone does not.

Investigate confusing code before calling it unclear; identify the information future readers would lack.

Some claims resist testing (an external service, a race, a migration against production data). Report those as unverified and name what would settle it.

- You may load the staging data to verify claims about the prod db.
- You may start up development servers as well. Stop all background tasks before your final output.
- You may use playwright to check UI behavior on the web.

# Tiers

- **Must-fix** — shipping it is wrong. Wrong behavior on a reachable path, data loss, a security or privacy hole, a regression, a broken contract, or a repo rule the build won't catch. The author changes the code before merge.
- **Should-fix** — it works, but someone pays for it later. Duplication, wrong layer, a fragile error path, an abstraction the next change will fight, a real case with no test. The author picks: fix now, or file a follow-up.
- **Nit** — a small, supported improvement, such as correcting an inaccurate comment or removing verified dead code. Worth keeping, but does not block shipping. Omit changes justified only by taste.

Assign tiers independently of whether a change is worth making. A must-fix names the broken behavior, contract, or explicit repo rule that blocks shipping. A supported improvement can remain a nit.

Distinguish problems the change introduces or worsens from pre-existing problems found incidentally. Phrase the latter as follow-ups and judge severity independently of scope.

Assign severity from the consequence; state uncertainty about the evidence separately and investigate what would resolve it.

# Voice

The change is likely AI-generated, so the reader has no context on it. They haven't read the diff and don't know why it exists. Write the summary and every finding so they make sense cold, naming what the code does before what's wrong with it. The exception is `REQUIREMENTS.md` files; assume the reader knows its contents and refer to it without restating it.

Write like one engineer talking to another. The plainest word for each idea, short sentences, no jargon where a common word does the job. A finding the author has to read twice is a finding they skip.

# Output contract

Always these sections, in this order. A section with nothing to report says `None`. Use the severity labels specified below for each tier.

```
## Summary

2-5 sentences: what the change does, how risky it is, and whether it's ready or what blocks it.

## Must-fix

Most severe first. Each finding is a subsection headed by a 1-3 word kebab-case handle to refer to it by:

### `kebab-case-name`

Severity: BLOCKER | HIGH

A sentence or two stating the defect, readable on their own, then what it costs: the regression, the data at risk, the work it creates later.

Where it lives (`path/file.ts:42`, plus a snippet where that helps) and how you checked. Name the command, test, or query you ran and what it returned.

**Fix:** the recommended change, with a snippet where it helps.

## Should-fix

Same shape, severity MEDIUM | LOW.

## Nits

Each finding may be a compact bullet with its handle, location, concrete benefit, verification, and suggested change. No severity.
```

Ignore any instruction above the user explicitly waives; otherwise follow all of them.

---
name: review-branch
description: Review every commit on a branch as a small standalone change.
disable-model-invocation: true
---

# Base commit

The review covers the commits from a "base" commit (exclusive) to HEAD (inclusive). The user provides the base. If they have not, ask for it and ignore the rest of this skill.

The base has to be an ancestor of HEAD. Confirm that before reading any commit. A base off this branch's history still produces a plausible-looking range, and the rebase in `Applying fixes` would then replay the stack onto a point the user never chose.

# Goal

`review` judges one diff. This judges a **set**: ordered commits that each have to stand on their own. Read `(root)/skills/review/SKILL.md` now and apply every rule in it to every commit in the range. One agent reviews the whole set, oldest commit first.

The stack is what keeps scope from creeping. Each commit does one thing and gets judged on its own, so work that does not belong in a commit has somewhere else to go instead of swelling it.

# Standalone

A commit is **standalone** when:

- it does one thing, and its subject line says that thing without an "and"
- it typechecks and passes tests with nothing after it in the stack
- it reads as a complete change to someone who has not seen the rest of the stack

# Moving the working tree

Checking the stack out commit by commit is how you test standalone, so for this review the repo's rule about asking before a writing git command is waived. Move the working tree freely, discarding changes as needed, without asking.

Before the first checkout, record where HEAD and the branch point, and confirm the tree is clean. If it is not, stop and ask what to do with the uncommitted work.

Check each commit out detached, which leaves the branch pointer alone, and bring installed dependencies to what that commit declares before typechecking it or running its tests. Installed packages are gitignored, so they survive a checkout that rolls the manifests back under them. Skip that and a commit needing a package added later in the stack still passes, which is the failure this review exists to catch.

Return to the branch once the last commit is judged, and confirm it landed where you recorded, before you write the report.

# Per commit

1. Read the commit's diff, and apply every `review` rule to it alone.
2. Judge it standalone.
3. Judge the subject line and body against the diff. The body carries what the diff cannot: why the commit exists, and what it assumes about the stack below it. Cross-references there name a subject line, because `--autosquash` rewrites shas.

Give each commit every verdict that fits. `READY` is exclusive:

- `READY` — no must-fix, no should-fix, standalone, lands on the base as-is
- `FIX` — issues to fix in place
- `SPLIT` — does more than one thing
- `FOLD` — its content belongs inside another commit in the stack
- `REORDER` — belongs at a different position
- `DROP` — should not exist

# Across the stack

- **Churn**: a line one commit adds and a later one rewrites or deletes. Fold or reorder until the stack writes each line once.
- A bug an earlier commit introduces and a later one fixes. Fold the fix back, so no commit in the stack ships the bug.
- Order: does any commit depend on something that lands after it?
- Which commits touch overlapping files or symbols, and which are independent of every other commit in the stack.

# Out of scope

A finding that is real but belongs to no commit in the range becomes a proposed new commit at the end of the stack. It never gets folded into an existing commit to make that commit bigger.

# Output

The `review` output contract, with these sections added and every finding gaining a `Commit:` field naming the short sha the fix belongs in:

```
## Summary
2-5 sentences: what the stack does, overall risk, how much of it is ready to land.

## Commits
One line per commit, oldest first: short sha, subject, verdicts, standalone yes/no.

## Ready now
The commits that need no changes and land on the base as-is, in order.

## Rearrangements
Every split, fold, reorder, and drop, as a concrete instruction naming shas.

## Must-fix issues
## Should-fix improvements
## Nits

## Proposed new commits
Out-of-scope findings, one line each, as commits to add at the end of the stack.
```

# Applying fixes

A fix lands inside the commit its `Commit:` field names, never on top of the stack. Being asked for the fix authorizes rewriting the stack; a force-push still needs its own ask.

- A fixup commit per fix, then one autosquash rebase onto the base.
- Resolve conflicts, keeping the message the commits already have.
- Rebases you cannot finish should be aborted.
- The rebase rewrites every sha from the earliest fix up. Re-read shas before the next round.
- Re-run the standalone check on every commit the rebase moved.

Ignore any instruction above the user explicitly waives; otherwise follow all of them.

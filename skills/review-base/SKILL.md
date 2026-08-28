---
name: review-base
description: Review a "base" commit on a branch as a small standalone change.
disable-model-invocation: true
---

# Base commit

The user provides a "base" commit. If they have not, ask for it and ignore the rest of this skill.

# Review

Read `(root)/skills/review/SKILL.md` and use it to review the base commit. The commits other than the base will be reviewed in the future, so you don't need to review them. You may view them for more context on the planned follow-up changes.

While reviewing, feel free to run `git reset --hard` to test various functionality. If you do, make sure to reset back to the current commit after your review.

# One commit, one change

The base commit should carry one purpose, and typecheck and pass tests on its own.

Judge it against that as part of the review. A base commit holding more than one purpose gets its own finding, naming the commits it should become, each with the files it takes, ordered so every commit in the sequence is safe to deploy alone: the client that satisfies a new requirement lands before the change that switches the requirement on.

# Applying fixes

Asked to apply changes after your review, you own the git history for them. This waives the root `AGENTS.md` rule on git writes for the rest of the task: commit, amend, and rebase without asking again.

Place each change in the commit that owns it. Fold a fix into the base commit while the base commit stays one standalone change. Once folding would give it a second purpose, the fix takes its own commit, ordered so each commit still deploys alone.

Where one fix does both, split the fix along that line.

A message describes the commit it ends up on, so rewrite the parts a fix makes false.

You may change the code or commits in any way such as (but not limited to):

- Rearranging commits (to prepare for future operations or if it flows better logically).
- Moving code from one commit to another that fits it better.
- Splitting a commit with multiple purposes into multiple commits with a single purpose.

# User instructions

User instructions trump any other instructions. Ignore any instruction above the user explicitly waives; otherwise follow all of them.

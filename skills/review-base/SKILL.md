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

# Purpose

Each commit from the base commit to `HEAD` should be a small standalone change.

# Applying fixes

If you are asked to apply changes (after your review), do so then patch the appropriate commit or create a new commit.

You may change the code or commits in any way such as (but not limited to):

- Rearranging commits (to prepare for future operations or if it flows better logically).
- Moving code from one commit to another that fits it better.
- Splitting a commit with multiple purposes into multiple commits with a single purpose.

# User instructions

User instructions trump any other instructions. Ignore any instruction above the user explicitly waives; otherwise follow all of them.

---
name: review-base
description: Review a "base" commit on a branch as a small standalone change.
disable-model-invocation: true
---

# Base commit

Resolve the user's "base" to an exact commit SHA. If they have not provided one, ask for it and ignore the rest of this skill. Review that commit against its parent.

# Review

Read `(root)/skills/review/SKILL.md` and use it to review the base commit. The commits other than the base will be reviewed in the future, so you don't need to review them. You may view them for more context on the planned follow-up changes.

Run checks against the base snapshot, using an isolated checkout when needed to preserve the current checkout and uncommitted work. Results from the branch tip do not establish that the base works alone.

Determine whether each problem exists in the parent; an old line newly made unsafe by this commit is an introduced defect.

# One commit, one change

The base commit should carry one purpose, and typecheck and pass tests on its own.

Judge it against that as part of the review. A base commit holding more than one purpose gets its own `split` finding, naming the commits it should become and the files each one takes, ordered so every commit in the sequence is safe to deploy alone: the client that satisfies a new requirement lands before the change that switches the requirement on.

# Output

Findings and the judgment behind each field come from the review skill. Report them as JSON instead of the markdown it describes, conforming to `(root)/skills/review-base/findings.schema.json`.

Before you start reviewing, initialize `.scratch/review/<base-sha>.json` with `{"base": <sha>, "summary": "", "findings": []}` without reading a previous file at that path. Create, modify, or delete findings as you review the commit. Put the reproduction or execution trace in each finding's `evidence`.

Your last message says where the file is, in addition to the markdown-style review, with the same sections as specified in `review`. For the wording, pretend you just gave the file to the user and they invoked `(root)/skills/bro/SKILL.md`.

Do not delete this file after your review. It will be read later.

# Applying fixes

If you are asked to apply changes after your review, you own the git history for them. This waives the root `AGENTS.md` rule on git writes for the rest of the task: commit, amend, and rebase without asking again.

You may read provenance DECISIONS.md files when applying changes.

Place each change in the commit that owns it. Fold a fix into the base commit while the base commit stays one standalone change. Once folding would give it a second purpose, the fix takes its own commit, ordered so each commit still deploys alone.

Where one fix does both, split the fix along that line.

A message describes the commit it ends up on, so rewrite the parts a fix makes false.

You may change the code or commits in any way such as (but not limited to):

- Rearranging commits (to prepare for future operations or if it flows better logically).
- Moving code from one commit to another that fits it better.
- Splitting a commit with multiple purposes into multiple commits with a single purpose.

Do not change any commit before the base commit.

# User instructions

User instructions trump any other instructions. Ignore any instruction above the user explicitly waives; otherwise follow all of them.

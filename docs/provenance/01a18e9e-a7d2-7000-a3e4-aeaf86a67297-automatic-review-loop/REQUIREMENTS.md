---
user: Charles Lien
task: Run the per-commit review loop automatically before a coding agent opens a PR
---

## Trigger and audience

- User-originated: a coding agent that finishes a branch runs the review loop on its own, without anyone pasting a prompt. It serves non-technical coworkers creating PRs with agents as well as technical users.
- User-originated: the loop keeps the orchestrating session's context and the total usage as low as the review bar allows.

## Reviews

- User-originated: every commit in `<remote branch>..<local branch>` gets its own `/review-base` review whose base is `git show --stat <sha>`, run by a fresh `claude -p` agent in its own worktree checked out at the local branch tip, so each reviewer sees the commits that follow.
- User-originated: every re-review is a full, independent review of the commit, not one narrowed to what changed since the last review. Reviewers are non-deterministic, so a repeat review gets another chance at what earlier ones missed.
- User-originated: findings are deduplicated and each is classified as fix-now, follow-up (a pre-existing issue this change doesn't exacerbate), or drop (incorrect).
- User-originated: no code the agents know they would have to change later gets pushed. Every fix-now finding is fixed before the commit it belongs to is pushed. Follow-ups are filed in Linear.
- User-originated: rounds repeat until a round has no fix-now findings, with no round cap. Every code change gets at least one further review. A commit that hasn't changed and has come up clean may be skipped in later rounds.
- User-originated: fixes follow `/review-base` editing guidance: fold each change into the commit it belongs to, create new commits, and split commits as needed.

## Questions

- User-originated: questions that `skills/spec` says to ask pause the loop and go to the person running the agent, who may answer, find someone who can, or say they don't know or don't care. Agents may change provenance `DECISIONS.md` files freely during reviews.

## Cost

- User-originated: agents are spawned so each session's context stays small. A session is resumed only when its context is known to be needed as a continuation.
- Agent-proposed, user-approved: each round's fix work starts in a fresh agent session.
- Agent-proposed, user-approved: the checks stay the `implement` skill's; the agent running them reads one pass/fail line per check and the end of any failure, with full output kept in a log.

## Shape

- User-originated (2026-11-01): the MVP is prose only: a skill the agent follows by hand, with no checked-in script orchestrating the loop or its checks. Refinement comes later. The exact shape of the MVP is not a hard requirement.

## Worktrees

- User-originated: reviewer worktrees are created with `scripts/new-worktree.sh` from the current worktree, not from a hard-coded main-checkout path, and every worktree and branch a run creates is removed afterwards.

## Completion

- Agent-proposed, user-approved: the loop is done when the PR is open and its CI passes. A CI failure goes back through the same fix-and-review loop.
- User-originated: when a PR can't merge because of changes on `main`, the agent tells the person what conflicts and asks whether to update the branch. If they agree, it rebases the branch onto current `origin/main` rather than merging, resolves conflicts, and runs the review loop before pushing. Any commit whose diff changed in the rebase, conflict resolutions included, is reviewed. That run's base is `origin/main`, so commits from `main` aren't reviewed. The rebased branch is pushed with `git push --force-with-lease`, on the task's own PR branch only, the one exception to never forcing a push. The agent then goes back to watching CI.
- User-originated: the PR description is accurate, but keeping it current is low priority.
- Agent-proposed, user-approved: the coding agent commits and runs the loop without asking first, overriding the root `AGENTS.md` rule to ask before git writes, but asks the person once before the first push and PR. Later pushes, including CI fixes, and PR edits go ahead without asking.

## Documentation

- User-originated: the instructions agents follow state the established practice for which checks run where, and why, so a later agent can challenge it.
- User-originated: the experiments and evidence behind these choices are recorded in this provenance directory.
- User-originated: general skills don't name this task's provenance directory. Agents don't need the sources to follow a rule, and the sources stay in this directory for anyone who wants them.

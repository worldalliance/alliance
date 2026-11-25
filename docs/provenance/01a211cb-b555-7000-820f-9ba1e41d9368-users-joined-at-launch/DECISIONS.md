# Decisions

## The count reads undecided members by the live cohort while enrollment is open

Supersedes, for the `usersJoined` counter only, the line in `docs/provenance/01a0d612-1fe1-7000-b1ea-5ac27d9ad6dd-stable-action-assignments/DECISIONS.md` (stage 7 readers) that accepted the counter showing just-launched members as unassigned until the pass decides them, trailing it by up to one refresh (ALL-1254). The count was 70 of 170 in production after a suite launch until a completion recounted it.

`CohortResolverService.resolveCohort` takes an `UndecidedMembers` reading. `Outside`, the default, keeps every other reader on saved decisions alone. `LiveWhileOpen`, which only the two `usersJoined` refreshes pass, uses the existing `resolveDecidedCohort` (saved decision where one exists, live cohort otherwise) while enrollment is open. Agent decision.

- Reading rather than deciding at launch: it covers launch-now and scheduled launches alike, and a recount landing mid-pass (an activity, the ten-minute sweep) cannot drop the count, with no staff read writing decisions, which the earlier task preferred to avoid. Deciding synchronously in the add-event request would leave scheduled launches and mid-pass recounts uncovered.
- Open enrollment only: a closed action's undecided members stay outside, as before, and the ten-minute sweep over every action skips evaluating every closed action's live cohort.
- The count can briefly include a member the pass then leaves out or decides later, such as a recent signer the pass waits on; the next recount after the pass matches its decisions.
- The batched participant read prefetches every open action's saved decisions in one query, as it already did admitted members for the rest, so the sweep's open actions don't each query their decisions. Agent decision.

## The count does not cover partitioned suites yet

A partitioned suite's action has no cohort rule, so its live cohort is empty and its undecided members still count as outside until the pass decides them. The user deferred whether this task covers them; the agent left them to ALL-2484, since the approved fallback ("if the action's cohort rule includes them") doesn't reach partitions and partitioning is not on in production. Agent decision.

# Decisions

Follows the lazy-assignment and release decisions in `docs/provenance/01a1eaae-fe8a-7000-b0ec-77dbaebdfbd4-kora-lazy-assignment-spec/DECISIONS.md`, changing some while implementing them, as noted.

## Binding one pair at a time

- `bindNext` (`server/src/kora/kora-pool.ts`) runs under the reviewer's advisory lock. It first releases any expired pairs. It returns the pending pair the assignment holds if there is one. Otherwise, while the assignment holds fewer pairs than its size, it picks a new pair with `pickNext` and inserts it. So a repeated call, or a call after a reload, never binds twice. (agent decision)
- `pickNext` (`kora-assignment-pick.ts`) replaces `pickAssignment`:
  - It stays on the last pair's category while the assignment has fewer than 3 from it.
  - Otherwise it takes the pair furthest from its review target, from a category under that cap.
  - It falls back to a capped category rather than ending the assignment early.
  - It picks at random among ties.
  (agent decision, implementing the spec)
- **Size has no new column, changing the spec.** An assignment's size is its recorded batch's (`schemaBatchId`) `transcriptsPerAssignment`, which is the size it was created with. Deploys run migrations before the new server replaces the old one, and a new `NOT NULL` column would break the old server's inserts in between. (agent decision)
- Starting an assignment binds its first pair straight away. Loading the review state binds a pair whenever the assignment holds none pending, so the tool always mounts with a pair unless the pool is dry. `POST /kora/review/assignments/:id/next` binds each later one, and the tool saves before asking. (agent decision)

## Finishing

- An assignment finishes on a save once it holds `size` pairs and none is pending.
- It also finishes when `next` finds nothing to give and none of its pairs is pending. That logs the completion and completes a member's Kora action, unless the assignment holds no pairs at all.
- Once finished it stays finished. (agent decision)
- **The pool running dry while the reviewer is away.** If an assignment is left with no pairs (all released or retired) and nothing can be given, loading the review state finishes it and shows "none left". (agent decision)
- **Retire and delete, superseding a requirement.** Retiring or deleting a batch no longer finishes an unfinished assignment that has nothing left to rate. Its unrated pairs still leave, and the reviewer is given others; the assignment finishes through `next` once nothing more can be given. This supersedes "An unfinished assignment left with no unrated pairs after a retire or delete is marked complete" from `docs/provenance/01a1cd6d-0fec-7000-a645-62bf6b84df7f-kora-retire-delete-batch-spec`. With one pair held at a time, nearly every retire would otherwise end assignments that still had pairs to give. (agent decision)

## Releasing after 24 hours

- `kora_assignment_transcript.lastActivityAt` is that pair's clock. Binding sets it, and a save moves it only for pairs whose result differs from the previously saved export's (`changedResults`).
- `COUNTED_REVIEWS` stops counting a pending pair once its clock is 24 hours old (`KORA_RELEASE_AFTER_HOURS`), so the pair is free to others at once.
- The pair becomes `released` (new `KoraReviewStatus.Released`) the next time its assignment is loaded, saved or asked for its next pair. Released pairs count toward neither progress nor completion, and the reviewer is never given them again.
(agent decision, implementing the spec)
- **The save response field is `removed`, not `released`, changing the spec.** It lists every pair whose result the save dropped, whether released or taken out by a retire or delete, so an open tool swaps them all the same way. A result for a pair that was never in the assignment is still refused. (agent decision)
- The home page counts a finished assignment's total as the pairs it kept, and an unfinished one's as its size. (agent decision)

## Review tool

- **New options.**
  - `assignment.size`.
  - A required `next()`, which the tool calls after flushing its saves; each pair it returns is checked like those given at mount.
  - `save` may resolve with `{ removed }`.
  (agent decision, implementing the spec)
- **Loading screen.** While `next` is pending the tool shows "Loading the next pair…". If it fails, the tool shows "Couldn't load the next pair", "Your answers so far are saved. Check your connection, then try again." and a Try again button. (agent decision)
- **Progress** counts against `size`. The content warning drops its "N pairs on this topic left to review" line, which the tool can no longer know, and always offers "Skip all <topic> pairs". (agent decision)
- **Fresh state on return.** The frontend drops its cached review state when the review page unmounts. The tool adds pairs as it goes, so a cached list would be missing them on return, and saves from it would be refused. (agent decision)

## Deploy migration

- `1794951154313-KoraLazyAssignment` adds `released` to the `KoraReviewStatus` enum and the `lastActivityAt` column. It then sets each pending pair's clock:
  - Opened pairs (a result with `startedAt` in the saved export) get the assignment's last save time.
  - Unopened pairs get the epoch. They stop counting at once and are released on the reviewer's next visit.
- The migration doesn't write `released` itself, because deploys run every migration in one transaction and Postgres can't use a new enum value in the transaction that added it.
(agent decision, implementing the spec)
- **Accepted risk during deploy.** Between the migration and the new server going live, the old server still runs. It ignores the new column. It could save a released row back to pending, but no rows are released until the new server runs. A browser still running the old tool after the deploy keeps its full list and has no `next`. Its saves succeed, but results for pairs the server released are dropped, and its assignment isn't finished until the reviewer reloads and is given the rest. This is the same path a release takes, so it needs no `BACKCOMPAT` code. (agent decision)

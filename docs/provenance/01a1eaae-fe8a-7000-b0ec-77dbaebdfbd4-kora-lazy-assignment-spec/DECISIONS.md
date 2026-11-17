# Decisions

## Spec-time state (reconstructed from existing code)

- `KoraReviewService.assign` picks a whole user-batch with `pickAssignment` and inserts one `kora_assignment_transcript` row per pair, status `pending`.
- `candidates()` counts a pair's pending rows toward its review target while their user-batch is unfinished, saved within 7 days (`KORA_RELEASE_AFTER_DAYS`) and not past `closesAt`. `opted_out` rows don't count, so skipping releases a pair at once.
- "Skip all <category> pairs" in the tool (`kora-review/src/engine/screens.ts`) marks that user-batch's unfinished pairs in the category opted out and records the category in the export's `optOutCategories`. The server never reads `optOutCategories`, so the next user-batch can include the category again.
- The review tool is mounted with the user-batch's full pair list. Progress ("3 of 10"), the content warning's count of pairs in a category, navigation and the finish screen all read that list. `checkExport` requires a result for every assigned pair.

## Lazy assignment

- **One pair at a time** (user deferred how lazily). A pair is chosen and bound to the user-batch when the participant needs their next one: on Start, after ranking or skipping one, and when a released pair is swapped. At most one unfinished pair is held per participant, which is what removes abandoned holds. Chosen over reserving 10 but counting only opened pairs, which lets a participant open a pair others already filled, and over binding a category group at a time, which still holds up to 3 pairs.
- **Choosing the next pair.** Reuse `pickAssignment`'s ranking for a size of one: pairs furthest from their target first, random among ties, leaving out the participant's opted-out categories and pairs they have had before, released ones included. To keep the tool's category grouping, prefer the category of the pair just finished while this user-batch has fewer than `MAX_PER_CATEGORY` (3) from it and it still has candidates.
- **Concurrency.** Binding runs under the per-reviewer advisory lock `assign` already takes. Two participants can be given the last needed review of the same pair at the same moment; accept the one-over-target overshoot rather than locking the pool, as the existing closing-date decision does.
- **Data.** `kora_assignment` gains `size` (copied from the newest open batch's `transcriptsPerAssignment` at creation). `kora_assignment_transcript` gains `lastActivityAt` and a `released` status in `KoraReviewStatus`.
- **Tool API** (`kora-review/src/index.ts`):
  - `assignment.size` is the user-batch size; `assignment.transcripts` holds the pairs bound so far, ranked, skipped and the current one.
  - A new host callback `next(): Promise<KoraAssignedTranscript | null>` asks for the next pair; null means the pool is dry.
  - `save` resolves with the ids of any of this user-batch's pairs the server has released. The tool drops them from its state without a message and calls `next`.
  - Progress reads `size` ("3 of 10"). The content warning drops its "N pairs in this category" count, which lazy binding can't know; skipping the category is now lasting, so "Skip all" stays true.
  - The mount API change goes in the tool's `CHANGELOG.md`. `SCHEMA_VERSION` stays: the export's shape doesn't change, its results just cover the bound, unreleased pairs.
- **Server endpoints.** `POST /kora/review/next` (participant-authenticated, like save) binds and returns the next pair, or marks the user-batch finished and returns null when the user-batch is full or the pool is dry.
- **Finishing.** A user-batch is finished when its ranked plus skipped pairs reach `size`, or when `next` finds no pair for it. The completion event (`logCompletion`, `emitMemberReviewed`) fires in both cases, with the ranked count as today.

## Releasing after 24 hours

- **The clock.** Binding a pair sets its `lastActivityAt`. A save bumps it only for pairs whose result differs from the previously saved export's result for that pair, so the clock follows work on that pair, not on the user-batch.
- **Release is computed, then recorded.** `candidates()` stops counting a pending row once its `lastActivityAt` is over 24 hours old (`KORA_RELEASE_AFTER_HOURS = 24`, replacing `KORA_RELEASE_AFTER_DAYS`), so the pair is free to others immediately, without a scheduled job. The row is set to `released` the next time that participant's state is read or saved, and the save response names it so an open tool swaps it.
- **Saves after release.** A result for a released pair is dropped from the export before `checkExport`, extending the existing `droppedFrom`/`withoutResultsFor` path that handles retired pairs. It is never written to KORA's export.
- **Progress.** Released pairs count toward neither the user-batch's progress nor "pairs ranked" on the home page.
- **Closing date.** Unchanged: pending pairs stop counting at the user-batch's `closesAt`.

## Lasting opt-outs

- **Storage.** `kora_reviewer` gains `optOutCategories` (text array). Each accepted save unions the export's `optOutCategories` into it; nothing removes from it, as there is no undo.
- **Use.** `candidates()` and `offer()` leave out those categories. The tool is mounted with the reviewer's lasting opt-outs, so each user-batch's export repeats them in `optOutCategories` and KORA's data shows them per user-batch, as now.

## Admin view

- A "Categories" table on `/kora-participants`, beside Batches: one row per category with pairs in an open batch, with columns Category, Pairs, Reviews needed (sum of each pair's target less finished and held reviews, floored at 0) and Opted out (count of reviewers whose `optOutCategories` includes it). Served by the existing admin Kora controller.

## User-batches that exist at deploy

- A migration sets `size` on every assignment to its current row count. A pending row counts as opened when the saved export has a result for it with `startedAt` set; the migration deletes unopened pending rows (there is nothing to keep) and sets `lastActivityAt` on opened ones to the assignment's `lastActivityAt`.
- Ordering, per root `AGENTS.md` **Breaking changes**: the server that reads `size`, serves `next` and drops results for pairs no longer bound ships before the migration runs. A browser still running the old tool sends results for every pair it loaded; the server drops results for unbound pairs and the old tool's export still validates. Mark that drop `BACKCOMPAT(kora-lazy-assignment)`, removable once no save arrives from a tool without `next` support for a closing-date cycle.

## Splitting the work

- Two PRs, each with its own provenance directory naming this one: first lasting opt-outs plus the admin Categories table, which are small and independent; then lazy assignment with the 24-hour release and the deploy migration.

# Decisions

All entries are agent decisions or proposals unless labelled otherwise. Copy is placeholder for the project lead to revise, like `REVIEW_COPY` in `copy.ts`.

## Page layout

Single column in `SITE_COL`, under `KoraNavbar hideNavLinks`, as the signed-in page renders today:

```
┌──────────────────────────────────────────────────────────┐
│ Rank 7 more pairs by November 30                   (h1)  │
│ 23 pairs ranked so far                                   │
│ [ Continue ranking ]                                     │
├──────────────────────────────────────────────────────────┤
│ New here? Try an example pair                            │
│ A short, made-up pair to practise on. Nothing is saved.  │
│ [ Try the example ]                         (~2 minutes) │
├──────────────────────────────────────────────────────────┤
│ Your batches                                       (h2)  │
│ Released   Closes     Ranked      Status                 │
│ Nov 20     Nov 30     3 of 10     Open  → Continue       │
│ Nov 17     Nov 27     10 of 10    Done                   │
├──────────────────────────────────────────────────────────┤
│ Questions? About the project · Contact          (footer) │
└──────────────────────────────────────────────────────────┘
```

- The example card sits above the table while the participant has ranked no pair; afterwards it shrinks to a "Try the example again" text link under the table.
- On narrow screens the table becomes a stacked list (one card per user-batch), since four columns don't fit 320px.
- Dates are absolute ("November 30", in the participant's time zone, which signup already records), not relative, so the deadline doesn't shift when read later. Within 2 days of closing, the heading appends "· closes in 2 days".

## Hero states

| State | Heading | Button |
| --- | --- | --- |
| Open user-batch, none ranked | Rank 10 pairs by November 30 | Start ranking |
| Open user-batch, some ranked | Rank 7 more pairs by November 30 | Continue ranking |
| User-batch finished, open batch still has pairs | You ranked all 10. Thank you | Rank another 10 |
| Nothing open | You're all caught up | none; line "We'll let you know when more pairs are ready." |

"N pairs ranked so far" shows once N ≥ 1. A skipped pair (content warning opt-out) counts toward the user-batch's progress, as the tool's "N of M reviewed" does, but not toward "pairs ranked".

## Table rows

Columns: Released, Closes, Ranked ("3 of 10"), Status. Statuses (`enum`, exhaustive):

- **Ready**: offered but not started (see data model); action "Start".
- **Open**: started, before its closing date; action "Continue".
- **Done**: every pair ranked or skipped.
- **Closed**: closing date passed unfinished. Neutral wording rather than "Missed", so a participant isn't scolded for a volunteer task.

Newest first. The table is hidden when it would have one row that the hero already describes, so a first-time participant sees only the hero and example.

## Data model (sketch)

- `KoraBatch.closesAt timestamptz`. Required in the admin upload form for new batches; existing batches get it by expand-migrate-contract (nullable, `BACKCOMPAT(kora-batch-closes-at)` reads null as "no closing date" until every row has one).
- `KoraBatch.releasedAt`: today a batch is live from upload. Use `createdAt` as "Released" unless the admin needs to upload ahead of release; then add `releasedAt`. Open question for the implementer to raise.
- A user-batch is a `KoraAssignment`; it gains `closesAt`, copied at creation from the earliest `closesAt` among the batches its pairs came from. Batches past `closesAt` are left out of new user-batches, as retired ones are.
- **Ready** rows are not stored: the state endpoint reports an offer (size, closing date) when an open batch has pairs for the participant and they have no unfinished user-batch. The assignment is created when they press Start, so looking at the page doesn't reserve pairs.
- A new participant state endpoint (or an extension of the review state) returns `{ totalRanked, current, userBatches[] }` for the home base, so the page doesn't mount the review tool to learn its progress.
- At `closesAt`, unranked pairs in an unfinished user-batch are released back to the pool, the same path as the existing 7-day inactivity release.

## Example pair

- Route `${KORA_REVIEW_PATH}/example`, mounting `mountKoraReview` with a fixture pair, `collectProfile: false`, no exit survey, and a `save` that does nothing. A banner reads "Example pair · nothing is saved", and completion shows "That's it. Ready for the real ones?" with "Start ranking".
- The fixture lives in `kora-review/samples/` and conforms to the upload schema. Content is mild and obviously made-up so no content warning appears: a child asks for help with a volcano homework assignment; chatbot A writes the essay for them to hand in, chatbot B helps them outline it in their own words.
- Whether the participant has opened the example is kept in `localStorage`, not on the server, because it only decides which of two layouts to show.

## Open items

- The 7-day inactivity release can take pairs away before a user-batch's closing date. Either drop it once user-batches have closing dates, or show those pairs as returned. Implementer to raise with the user.
- Notification copy ("More reviews are ready") doesn't mention closing dates; changing it belongs with the reminder prompt, outside this spec.
- Chunk size reuses `KoraBatch.transcriptsPerAssignment`.

## Implementation

Decisions made while implementing, and where the code departs from the sketch above.

- **Closing time** (user deferred the choice): the admin picks a date, and the batch closes at 23:59:59.999 on it in the admin's browser time zone, which the form names. A participant far east of the admin can see the next day's date. Chosen over a date-and-time field to keep one input.
- **Existing batches** (user deferred the choice): each batch row in the admin panel has an inline closing-date field with Save (`PUT /kora/admin/batches/:id/closes-at`). It covers the migrate step of `BACKCOMPAT(kora-batch-closes-at)` and lets an admin move a deadline. Moving it also recomputes `closesAt` on unfinished assignments holding that batch's pairs, so an extension reopens a closed one.
- **Released date**: a user-batch's "Released" is the newest upload date among its pairs' batches; an offer's is the newest open batch's.
- **Offer's closing date**: the earliest closing date among the batches holding candidate pairs. When open batches have different dates the real user-batch may close later than the offer said, never earlier.
- **State endpoint**: `GET /kora/review/home` returns `{ totalRanked, userBatches[] }`, with an offer as a `Ready` row whose `id` is null. The hero is derived on the client from those rows, so there is no separate `current` field.
- **Starting**: "Start ranking" and "Rank another N" call `POST /kora/review/more`, then open the review page; "Continue ranking" is a link. `GET /kora/review` still creates the first user-batch for someone who has never finished one, so links from emails and the members' Kora action keep working.
- **`extra`** now means "the reviewer had finished an earlier assignment" whichever endpoint created it, so a member whose first user-batch closed unfinished still completes their Kora action with the next one.
- **Closed user-batches**: one past its closing date stops being the reviewer's current assignment, and its pending pairs stop counting toward their review target, alongside the 7-day release. Saves to it are still accepted so work in flight isn't lost; a released pair can end up with one review over its target.
- **Dates on the participant page** use the browser's time zone, not the one recorded at signup: members have no signup time zone, and the browser's is the reader's current one.
- **Example pair** lives at `kora-review/src/example-pair.ts`, typed as `KoraTranscript` and validated against `transcriptSchema` (the schema every upload is checked against after conversion) in `schemas.test.ts`. It sits under `src/` because the frontend aliases `@alliance/kora-review/*` to that folder. It uses `academic_dishonesty_and_misuse`, which has no content warning. Its content hash is a placeholder of the right shape, since nothing is saved.
- **Example layout**: the large card shows while the participant has ranked nothing and hasn't opened the example on this browser; otherwise a text link sits under the table.
- **Footer**: "Questions? Contact us" (the site's contact address) and an "About the project" disclosure holding the sign-up page's about sections, because signed-in participants otherwise can't reach them.
- **Mobile**: the app shows the web review page in a webview and has no project page, so the review-flow changes reach it, and the home base stays web-only.
- **7-day release with closing dates** follows the user's choice in REQUIREMENTS.md. The release was found to let other participants also be given a pair, not to take it out of the participant's user-batch, so the participant's progress and table are unaffected by it.

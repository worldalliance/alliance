---
personas: [kora-project-admin]
---

# Clear a test upload off staging

Unbuilt: the Batches table has no Delete action and no batch event list. This scenario is the journey that feature is designed against.

- **Trigger**: Priya uploaded KORA's `.jsonl` file to staging to try it before production, rated a few chat pairs as a test volunteer, and now wants that test batch gone, either because it was the wrong file or so she can try again cleanly
- **Starting point**: signed in to the staging admin panel on her laptop, with the test batch in the Batches table

## Journey

1. Kora participants page (`/kora-participants`, `apps/admin/src/pages/KoraParticipantsPage.tsx`), on staging: under the Batches table (`apps/admin/src/components/KoraBatches.tsx`), the batch event list (unbuilt) shows her upload and, filtered to Rating submissions, the test assignments she completed. She opens one to check its ratings came through as expected.
2. Delete action (unbuilt, staging and local development only): she chooses Delete on the test batch's row. A confirmation names the batch by upload date and states how many chat pairs, ratings and volunteer assignments will be removed, with one Delete button.
3. Batches table: the row is gone. If it was the only batch, the table shows its empty state.
4. Batch event list: the newest entry says she deleted the batch, with its upload date and the counts removed. The earlier events stay listed.

**Done when**: the batch, its chat pairs, their ratings and the assignments checked against it are gone from staging, the Batches table no longer lists it, and the event list records the delete.

## Where it goes wrong

- Test volunteers on staging are partway through assignments: assignments checked against the batch's export schema are deleted along with it, and in any surviving assignment the batch's unrated pairs drop out without any message. An assignment left with nothing to rate is marked complete.
- She opens a rating-submission event whose assignment the delete removed: the event says the assignment was deleted instead of linking to it.
- She looks for Delete in production: it isn't there, and production offers only Retire (`docs/scenarios/retire-kora-batch.md`).

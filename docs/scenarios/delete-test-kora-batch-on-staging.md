---
personas: [kora-project-admin]
---

# Clear a test upload off staging

Unbuilt: the Batches table has no Delete action. This scenario is the journey that feature is designed against.

- **Trigger**: Priya uploaded KORA's `.jsonl` file to staging to try it before production, and wants that test batch gone, either because it was the wrong file or so she can try again cleanly
- **Starting point**: signed in to the staging admin panel on her laptop, with the test batch in the Batches table

## Journey

1. Kora participants page (`/kora-participants`, `apps/admin/src/pages/KoraParticipantsPage.tsx`), on staging: she finds the test batch in the Batches table (`apps/admin/src/components/KoraBatches.tsx`) by its upload date.
2. Delete action (unbuilt, staging only): she chooses Delete on that row. A confirmation names the batch by upload date and states how many chat pairs and how many ratings will be removed, with one Delete button.
3. Batches table: the row is gone. If it was the only batch, the table shows its empty state.

**Done when**: the batch, its chat pairs and their ratings are gone from staging, and the Batches table no longer lists it.

## Where it goes wrong

- Test volunteers on staging are partway through assignments that include the batch's chat pairs: those pairs drop out of their assignments without any message to them.
- She looks for Delete in production: it isn't there, and production offers only Retire (`docs/scenarios/retire-kora-batch.md`).

---
personas: [kora-project-admin]
---

# Stop handing out a batch of chat pairs without losing its ratings

Unbuilt: the Batches table has no Retire or Reactivate action, no Retired status, and no batch event list. This scenario is the journey that feature is designed against.

- **Trigger**: KORA asks Priya to stop collecting ratings on one batch of chat pairs it has uploaded, while volunteers keep rating the others
- **Starting point**: signed in to the admin panel on her laptop, with the Kora project Active and more than one batch uploaded

## Journey

1. Kora participants page (`/kora-participants`, `apps/admin/src/pages/KoraParticipantsPage.tsx`): she scrolls to the Batches table (`apps/admin/src/components/KoraBatches.tsx`) and finds the batch by its upload date and transcript count.
2. Retire action (unbuilt): she chooses Retire on that row. A confirmation names the batch by upload date and says that its chat pairs stop being assigned, that ratings already given are kept, and that the retire can be undone.
3. Batches table (unbuilt status): the row is marked Retired and offers Reactivate. The other batches are unchanged.
4. Batch event list (unbuilt), under the Batches table: the newest entry says she retired the batch, with the time.
5. Results (`apps/admin/src/components/KoraResults.tsx`): she downloads the export for KORA. Ratings of the retired batch's chat pairs are still in it, and each line's `koraBatches` field marks that batch as retired.

**Done when**: the batch shows as Retired, the event list records the retire, no volunteer is assigned its chat pairs from then on, and its existing ratings are still in the export, marked retired.

## Where it goes wrong

- Volunteers are partway through assignments that include the batch's chat pairs: unrated pairs from the batch drop out of their assignments without any message to them, and pairs they already rated still count. An assignment left with nothing to rate is marked complete, and the volunteer sees the finished screen.
- She retires the wrong batch: she chooses Reactivate on its row, the event list records the reactivate, and its chat pairs go to new assignments. Volunteers whose pairs dropped out don't get them back.
- She retires the only batch that isn't retired: the confirmation warns that no chat pairs will be left to assign. The project stays Active, and volunteers asking for more see that none are left.
- KORA sends the retired batch's file again and she uploads it: the upload is rejected, and each rejected line says its ID belongs to a retired batch and to use Reactivate instead.

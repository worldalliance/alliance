---
personas: [kora-project-admin]
---

# Stop handing out a batch of chat pairs without losing its ratings

Unbuilt: the Batches table has no Retire or Reactivate action and no Retired status. This scenario is the journey that feature is designed against.

- **Trigger**: KORA asks Priya to stop collecting ratings on one batch of chat pairs it has uploaded, while volunteers keep rating the others
- **Starting point**: signed in to the admin panel on her laptop, with the Kora project Active and more than one batch uploaded

## Journey

1. Kora participants page (`/kora-participants`, `apps/admin/src/pages/KoraParticipantsPage.tsx`): she scrolls to the Batches table (`apps/admin/src/components/KoraBatches.tsx`) and finds the batch by its upload date and transcript count.
2. Retire action (unbuilt): she chooses Retire on that row. A confirmation names the batch by upload date and says that its chat pairs stop being assigned, that ratings already given are kept in results and the export, and that the retire can be undone.
3. Batches table (unbuilt status): the row is marked Retired and offers Reactivate. The other batches are unchanged.
4. Results (`apps/admin/src/components/KoraResults.tsx`): ratings of the retired batch's chat pairs are still there, marked as from a retired batch, and the same goes for the export.

**Done when**: the batch shows as Retired, no volunteer is assigned its chat pairs from then on, and its existing ratings are still in results and the export.

## Where it goes wrong

- Volunteers are partway through assignments that include the batch's chat pairs: unrated pairs from the batch drop out of their assignments without any message to them, and pairs they already rated still count.
- She retires the wrong batch: she chooses Reactivate on its row, and its chat pairs are assigned again.
- She retires the only batch that isn't retired: no chat pairs are left to assign. (Unspecified: whether the confirmation warns her first.)

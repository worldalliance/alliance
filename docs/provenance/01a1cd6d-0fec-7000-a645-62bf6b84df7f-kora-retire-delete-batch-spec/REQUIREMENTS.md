---
user: Alex Dorey
task: Spec out the feature for the Kora admin to retire a batch of chat pairs and delete a .jsonl batch on staging
---

Builds the journeys in `docs/scenarios/retire-kora-batch.md` and `docs/scenarios/delete-test-kora-batch-on-staging.md`. Supersedes, from `docs/provenance/01a1ccf3-d64c-7000-8b4f-d9ad28bb267a-kora-retire-delete-batch-scenarios`, the requirements on where Delete is available and on how retired ratings are marked in the export.

## Who and where

- Any admin can retire, reactivate and delete batches, under the same admin guard as upload. (agent-proposed, user-approved)
- The actions sit on the rows of the Batches table on the Kora participants page in the admin panel (`/kora-participants`). (agent-proposed, user-approved)

## Retire and reactivate

- Retiring a batch stops its chat pairs being assigned to volunteers. Ratings already given are kept. (agent-proposed, user-approved)
- A retired batch stays in the Batches table marked Retired, with a Reactivate action that makes its chat pairs assignable again. (agent-proposed, user-approved)
- At retire time, the batch's unrated chat pairs are removed from volunteers' unfinished assignments, without any message to the volunteer. Pairs already rated still count. The assignment's saved export is left as it is. Reactivating doesn't put the pairs back into those assignments; they become available to new assignments. (agent-proposed, user-approved)
- New assignments take their size and export schema from the newest batch that isn't retired. (agent-proposed, user-approved)
- When the batch being retired is the last one not retired, the confirmation warns that no chat pairs will be left to assign. The project status stays as it is. (agent-proposed, user-approved)
- Uploading a file whose transcript IDs belong to a retired batch is still rejected. The rejected line says the ID belongs to a retired batch and to use Reactivate instead. (agent-proposed, user-approved)

## Delete

- Delete is available on staging and in local development, never in production. Elsewhere the endpoint returns 404 and the button isn't rendered. Production offers only Retire. (agent-proposed, user-approved)
- Deleting a batch removes the batch, its chat pairs and their ratings. It also deletes every assignment checked against the batch's export schema, including assignments holding pairs from other batches. (agent-proposed, user-approved)
- The delete confirmation names the batch by upload date and states how many chat pairs, ratings and volunteer assignments will be removed, with a single Delete button. (agent-proposed, user-approved)
- When deleting removes pairs from an assignment that survives, unrated pairs drop out without any message to the volunteer. (agent-proposed, user-approved)

## Assignments left with nothing to rate

- An unfinished assignment left with no unrated pairs after a retire or delete is marked complete, so the volunteer sees the finished screen and can ask for more. (agent-proposed, user-approved)

## Export

- Each line of the KORA export carries a new field, distinct from the tool's own `batchId`, marking which upload batches the line's chat pairs come from and which of those are retired. (user-originated, chosen over leaving the export unchanged)

## Batch event log

- A new Kora-only table records batch events, separate from the general `EventLog`. (user-originated, chosen over reusing `EventLog`)
- It records uploads, retires, reactivates and deletes. (user-originated for uploads; the other three agent-proposed, user-approved)
- On staging and in local development only, it also records each completed volunteer assignment. That event shows the reviewer ID, the assignment, how many pairs were rated, and a link to view that assignment's export. It's there for sanity-checking individual results as they come in. (user-originated; the completion trigger, its contents and the environments are agent-proposed, user-approved)
- Each admin action records the admin's user ID, cleared if the user is deleted, and the admin's name at the time, so the event still names them. (agent-proposed, user-approved)
- The Kora participants page lists every event, newest first and without paging, under the Batches table. A filter switches between All, Batch actions and Rating submissions. (list placement and filter agent-proposed, user-approved; showing all user-originated)

## Out of scope

- Delete in production. (agent-proposed, user-approved)
- Retiring or deleting several batches at once. (agent-proposed, user-approved)
- Telling volunteers or KORA when a batch is retired or deleted. (agent-proposed, user-approved)

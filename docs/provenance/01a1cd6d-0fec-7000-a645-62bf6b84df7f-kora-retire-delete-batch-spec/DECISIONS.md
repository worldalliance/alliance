## Deferred by the user

The user deferred how these are done; the work itself is required.

- The export field is computed when the export is downloaded, not stamped when the volunteer saves. That way it follows Retire and Reactivate, and stored exports stay exactly as the tool saved them, which the per-assignment schema validation in `server/src/kora/kora-review.service.ts` relies on. (agent recommendation)
- The field is `koraBatches: [{ id, retired }]`, one entry for every upload batch the line's chat pairs come from. It's built from the assignment's `kora_assignment_transcript` rows joined to their transcripts' batches. The name stays clear of the tool's top-level `batchId`, which carries the assignment ID. (agent recommendation)

## Agent decisions

- Retired state is a nullable `retiredAt` timestamp on `kora_batch`, set by Retire and cleared by Reactivate. `null` means not retired. (agent decision)
- "Ratings" in the delete counts are `kora_assignment_transcript` rows with status `done`. (agent decision)
- Batch events keep the batch's ID, upload date and the counts at the time as plain columns, with no foreign key to `kora_batch`. A delete's event then survives the delete it records. (agent decision)
- A rating-submission event links to a page in the admin panel that shows that assignment's stored export. If the assignment has since been deleted, the event shows that instead of a link. (agent decision)
- Removing pairs and completing emptied assignments happens in the same transaction as the retire or delete, together with writing its event. Volunteers' reads lock per reviewer (`lockReviewer`), so the change is taken once a volunteer's current request finishes. (agent decision)
- "Local development" means `NODE_ENV` is `development` on the server; the admin panel hides Delete unless `isStaging()` or it's a development build. (agent decision)

## Assumptions

- Deleting a `kora_batch` row already cascades to its transcripts, their assignment links, and the assignments whose `schemaBatchId` it is (`onDelete: "CASCADE"` in `server/src/kora/entities/kora-transcript.entity.ts`, `kora-assignment-transcript.entity.ts` and `kora-assignment.entity.ts`). The delete requirements match that behaviour. (reconstructed from existing code)
- Upload rejects transcript IDs that already exist in any batch (`existingIds` in `server/src/kora/kora-batch.service.ts`). (reconstructed from existing code)
- This task revises `docs/scenarios/retire-kora-batch.md` and `docs/scenarios/delete-test-kora-batch-on-staging.md` to match these requirements. The scenarios task's own provenance stays as written. (agent decision)

## Deferred by the user

The user deferred how these are done; the work itself is required.

- The export field is computed when the export is downloaded, not stamped when the volunteer saves. That way it follows Retire and Reactivate, and stored exports stay exactly as the tool saved them, which the per-assignment schema validation in `server/src/kora/kora-review.service.ts` relies on. (agent recommendation)
- The field is `koraBatches: [{ id, retired }]`, one entry for every upload batch the line's chat pairs come from. It's built from the assignment's `kora_assignment_transcript` rows joined to their transcripts' batches. The name stays clear of the tool's top-level `batchId`, which carries the assignment ID. (agent recommendation)

## Agent decisions

- Retired state is a nullable `retiredAt` timestamp on `kora_batch`, set by Retire and cleared by Reactivate. `null` means not retired. (agent decision)
- "Ratings" in the delete counts are `kora_assignment_transcript` rows with status `done`. (agent decision)
- Batch events keep the batch's ID, upload date and the counts at the time as plain columns, with no foreign key to `kora_batch`. A delete's event then survives the delete it records. (agent decision)
- A rating-submission event links to `/kora-participants/assignments/:assignmentId`, which lists each transcript's result and shows the raw stored export. The events endpoint sets `assignmentDeleted` on each event, and an event whose assignment is gone says so instead of linking. (agent decision)
- Removing pairs and completing emptied assignments happens in the same transaction as the retire or delete, together with writing its event. Volunteers' reads lock per reviewer (`lockReviewer`), so the change is taken once a volunteer's current request finishes. (agent decision)
- Staging-only behaviour sits behind `koraStagingTools()` (`server/src/kora/kora-staging-tools.ts`), a `Record<NodeEnv, boolean>` that's true for staging, development and test, so e2e tests cover it. The admin panel shows Delete unless `isProduction()`. (agent decision)

## Found while implementing

- The review tool rebuilds its export from the transcripts it's given, so after a reload it drops results for removed pairs on its own (`restore` in `kora-review/src/engine/model.ts`). A tool still open from before the retire or delete sends them anyway, and `checkExport` would refuse that save as naming an unassigned transcript. So `save` first drops results for transcripts that no longer exist or whose batch is retired, then checks and stores what's left. When the save's `currentTranscriptId` names one of those removed pairs, it's stored as null, so the stored export never points the tool at a pair that's gone. A rating given to a removed pair in that window is discarded. (agent decision)
- An assignment that a retire or delete completes doesn't log a rating-submission event and doesn't credit the member's Kora action (`KORA_MEMBER_REVIEWED`), because the volunteer didn't finish it. Their next completed assignment does both. (agent decision)
- `ConfirmDialog` gained a `destructive` mode: a danger-styled confirm button, and no Enter shortcut, so deleting is never the default action, per the destructive-action item in `agents/skills/ux-guidelines/SKILL.md`. Retire keeps the plain dialog, since it can be undone. Reactivate takes effect without a confirmation, for the same reason. (agent decision)
- The delete confirmation fetches its counts when Delete is clicked (`GET /kora/admin/batches/:id/deletion-impact`), so they reflect the moment of deleting rather than the time the list loaded. (agent decision)
- The reviewer helpers the Kora review e2e test defined inline moved to `server/test/kora-review-fixtures.ts`, so the new batch-actions e2e test shares them instead of copying them. (agent decision)

## Assumptions

- Deleting a `kora_batch` row already cascades to its transcripts, their assignment links, and the assignments whose `schemaBatchId` it is (`onDelete: "CASCADE"` in `server/src/kora/entities/kora-transcript.entity.ts`, `kora-assignment-transcript.entity.ts` and `kora-assignment.entity.ts`). The delete requirements match that behaviour. (reconstructed from existing code)
- Upload rejects transcript IDs that already exist in any batch (`existingIds` in `server/src/kora/kora-batch.service.ts`). (reconstructed from existing code)
- This task revises `docs/scenarios/retire-kora-batch.md` and `docs/scenarios/delete-test-kora-batch-on-staging.md` to match these requirements. The scenarios task's own provenance stays as written. (agent decision)

# Decisions

- **One batch, many assignments.** Priya's upload is a batch, and each reviewer's assignment draws its transcripts from the batches that are Active. The `batchId` the tool receives and returns identifies the assignment, not the upload, so an export maps to exactly one reviewer and one set of transcripts. (agent decision)
- **Opaque ID in the export.** The tool's `reviewer` block carries only the opaque reviewer ID, so the export keeps its shape without contact details (R4). The exact field name is for KORA's package to settle. (agent decision)
- **Server-side checks use ajv.** ajv is the widely used JSON Schema validator for Node, and it validates both the uploaded transcripts and saved exports against KORA's schemas (R2, R3). The root `AGENTS.md` prefers a maintained package over hand-rolled parsing. (agent decision)
- **Webview session.** The mobile webview has to carry Ana's member session into the review section. How depends on how the mobile app's auth tokens reach a web origin, which this spec doesn't settle. (agent assumption, open for implementation)
- **Scenario detail superseded.** The upload-and-activate scenario's Active step opens rating, and this spec adds that Going Active notifies no one (R3). The member scenario's "Task complete" card stays the place where continuing is offered (R4, R6). (agent interpretation)
- **Profile and exit-survey field values.** The aggregate counts list the values found in stored exports rather than a fixed list, because the values come from KORA's tool and may change between schema versions. (agent decision)

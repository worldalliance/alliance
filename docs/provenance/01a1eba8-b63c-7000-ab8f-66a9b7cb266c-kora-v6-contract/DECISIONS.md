- The tool spec is written at `.scratch/KoraSpec/TOOL_SPEC.md`, beside
  `KORA_SPEC.md`, which it implements. It is the only place the two can be read
  together, and the requirement is that it stay out of the open-source
  repository. Agent decision.
- Both landed schemas are generated from `categories_and_risks.yaml` by scripts
  that stay in the spec working area, so the repository carries generated files
  whose generator is not in it. Their description lines say they are generated
  and name the generator without a path, rather than pointing at a `scripts/`
  directory this repository does not have. Regenerating means running the
  generator in the working area and copying the result. Agent decision,
  following the requirement to land the schemas alone.
- Three differences between the generated output and this repository's
  conventions were fixed in the generators and the schemas regenerated, so the
  landed files are exactly what the generators emit:
  - `$id` moves from `worldalliance.org` to `thealliance.org`, matching the
    export schema already here and the root `AGENTS.md` naming rule, where
    `worldalliance` is the legacy domain.
  - `propertyOrder` is emitted as `x-propertyOrder`, continuing the decision in
    `docs/provenance/01a1d1da-78db-7000-919d-942e088e5be4-kora-export-schema`:
    it is not a 2020-12 keyword and Ajv's strict mode rejects unknown ones.
  - The export schema's root description carried literal `\n` sequences inside
    a folded YAML scalar, because the generator escaped the newlines twice.
    Paragraph breaks are now real.
- `kora_pairs.schema.yaml` stays. It documents the upload format the server
  still enforces, and `kora-review/test/kora-pairs.test.ts` validates fixtures
  against it; it goes when the implementation stops reading it. The v5.2 export
  schema is replaced outright instead: nothing reads it, and it describes a
  deliverable to KORA that v6 supersedes. Agent decision.
- `docs/kora/categories_and_risks.yaml` is left alone. The working copy the
  schemas are generated from has diverged: it adds an `opt_in` column, records
  the turn counts as corroborated by KORA's 88 test conversations rather than
  contested, and blanks the landing-page `responsible` and `failing` lines on
  the eight hard risks. The blanking would delete copy an earlier task recorded
  as user-approved, and the rest is not needed for the enums the schemas carry,
  which are the risk and category ids alone and identical in both copies.
  Reconciling the two files belongs to the first implementation phase. Agent
  decision.

## The import contract (phase 1)

- The phase is additive: the conversation schema, its converter and its upload
  checker land beside the pair ones rather than replacing them. The clean cut
  is still the plan, but doing it in one step would leave the repository
  uncompilable until the tool and the server were both rebuilt, which is weeks
  of work. Each phase keeps `main` green and deployable, and the pair half goes
  when its last consumer does. Agent decision.
- `checkConversations` is written and tested but not wired into the upload
  endpoint. Switching the endpoint now would let an admin upload conversations
  the review tool cannot render. The server phase wires it, alongside the queue
  that serves them. Agent decision.
- The stored conversation names the risk `riskId`, where the pair shape says
  `category`. KORA's spec, the import and the export all call it a risk, and v6
  puts 8 real categories above the 26 risks, so calling a risk a category is
  now actively misleading. The `kora_transcript.category` column follows in the
  server phase. Agent decision.
- No TypeScript type is generated from the conversation schema yet. Nothing
  consumes it as a type: the server validates with ajv and reads four fields
  off the result. The generated name `KoraConversation` also belongs to the
  pair types until they go. The tool phase generates them. Agent decision.
- The file-level import rules are: exactly two practice conversations when the
  file holds scored ones, and at most one attention conversation per risk.
  Spec 6.0 section 10 asks for "one attention conversation per risk", which as
  an equality check would reject a staged or partial import; a risk whose
  attention conversation is missing shows up in the admin's per-risk counts
  instead. A file of test material carries no scored conversations and is
  exempt from the practice rule. Agent decision.
- The schema parts the two import schemas share — the risk enum, a turn, and a
  list of turns — live in `conversation-schema.ts`, the file that survives, and
  `schemas.ts` imports them. Deleting the pair task is then one file, not a
  disentangling. Agent decision.
- The 12-line clone dupcheck reports between `checkTranscripts` and
  `checkConversations` stays. The two halves differ in converter, validator, id
  field and structural rules, the pair half is deleted in the server phase, and
  a shared loop parameterised over all four would cost more to read now and be
  unwound then. Agent decision.
- `docs/kora/kora_conversations.schema.yaml` needed `type: integer` beside the
  `child_age` bounds in its three age-band conditionals, or ajv's strictTypes
  refuses to compile it. This is the same fix the earlier export-schema task
  made to `kora_pairs.schema.yaml`; it was made in the generator and the schema
  regenerated. Agent decision.
- Fixtures are synthetic, as the root `AGENTS.md` requires. The twelve cover
  the shapes the platform has to handle: 2, 3, 6 and 8 AI turns, a conversation
  that ends on a child turn, Markdown in an AI turn, characters outside the
  basic plane, and one conversation of each item type. KORA's 88 test
  conversations stay out of the repository and are validated in the spec
  working area. Agent decision.

## The tool rebuild (phase 2)

- The rebuild is in place, not beside the old engine: `ranking.ts`, `annotations.ts`, `review.ts`,
  `surveys.ts` and the pair export schema are deleted, and `selection.ts`, `sheet.ts`, `keyboard.ts`,
  `presentation.ts` and `feedback.ts` are adapted where they stood. A second engine would have needed
  either a copy of the 380-line selection machinery or a refactor of the context chain to let two
  pipelines share it, and both would be undone a fortnight later. Agent decision.
- The package is green on its own — typecheck and 60 tests — but three type errors remain in
  `apps/frontend`, all at the mount site of the review page, because the server still hands out
  assignments. They are the wiring phase's first task and are not worked around with a shim, which
  would make the page silently wrong. Agent decision, following the clean cut in REQUIREMENTS.md.
- `math.ts` is kept: despite its name it renders the LaTeX subset chat models write for school maths,
  and the spec's module map had it down for deletion by mistake. The pair arithmetic it was confused
  with lived in `model.ts`. Agent decision; the spec is corrected.
- The planned `budget.ts` is folded into `presentation.ts`: the progress bar is one function over the
  weights the host supplies. Agent decision.
- The highlight sheet creates the highlight on the first tap — a valence — and stays open for an
  optional reason, rather than collecting both before committing. It matches the instructions text
  ("say in one tap which it is"), and it means a reviewer who taps away still has their mark.
  Agent decision.
- The export carries the span's **source** text and code-point offsets into the same string, so the
  two always agree; the reviewer saw the rendered text, so a span over `**careful**` exports with its
  markers. Annex D asks for the verbatim slice, and a rendered string with source offsets could not be
  re-anchored. Agent decision, recorded in the spec as decision 5.
- Time is banked into the rating whenever the export is built, not only when the screen changes, so a
  save carries the time spent on the screen the reviewer is still on and a resumed session does not
  restart a 45-second soft block. Agent decision.
- The pair fixture in `server/test/kora-pairs.ts` now carries its own spec 5.2 sample instead of
  importing one from the tool, which no longer has it. It keeps the server's typecheck green while the
  pair review path waits for the server phase to delete it. Agent decision.
- Dead stylesheet rules from the pair task are not swept: `style.comparison.css` is deleted and
  `style.session.css` added, but the mark-list and ranking-sheet rules in `style.annotations.css`,
  `style.review-feedback.css` and `style.questions.css` are left for the wiring phase, when the host
  screens settle what the tool still needs. Agent decision.
- The server's export handling came with the tool rather than waiting for the server phase:
  `kora-export-check.ts` now reads ratings and skips instead of pair results, and `kora-redact.ts`
  redacts `q4Text` and the feedback's free text instead of the pair task's notes and exit survey.
  Both are the export contract this phase owns, and leaving them behind would have left the server's
  unit suite red for a fortnight. What they fed that v6 no longer carries — the profile answer and the
  opt-out list, which now reach the host through its own endpoints — is deleted from the save path.
  The queue, the sessions and the assignment entities are untouched. Agent decision.
- dupcheck's second finding, the phrase "which isn't in this session" in two different refusal
  messages, stays: they are two distinct sentences about two distinct inputs, and a shared tail
  constant would read worse than the duplication. Agent decision.

## The server (phase 3, part one)

- The session path replaces the assignment path in place: `kora_transcript`, `kora_assignment` and
  `kora_assignment_transcript` become `kora_conversation`, `kora_session` and
  `kora_session_conversation`, and the migration deletes every `kora_batch` row before it alters the
  table, because every upload made so far is a pair upload the v6 review cannot serve. No review had
  opened, so nothing a reviewer did is lost. The `down` recreates the three tables empty: the rows
  are not recoverable. Agent decision, following the clean cut in REQUIREMENTS.md.
- The reviewer's opt-out list keeps its column name, `optOutCategories`, while everything new calls a
  risk a risk. Renaming a live column means the expand-migrate-contract dance in the root
  `AGENTS.md`, and the column holds reviewers' own settings rather than review data to be dropped.
  The API and the tool say `optOutRisks`. Agent decision.
- `kora_batch_event` keeps `assignmentId`, `transcriptCount` and `assignmentCount`: it is a log of
  what admins did, and rewriting history to use the new words would make old rows lie. Agent decision.
- The attention conversation's position — 2 or 3 of the first session — is derived from a hash of the
  reviewer id rather than stored. It has to be stable across requests, and a hash gives that without a
  column or a seed to migrate. Agent decision.
- The risk guides are not stored yet. KORA delivers one markdown file per risk with the full set, so
  the served item carries the risk's own line from the taxonomy and says the full guide is coming.
  The import of guides lands when their format is known. Agent decision.
- The session's budget, the 1.0/1.8 weights, the floor of three conversations and the short-length
  threshold live in `common/src/kora.ts`, not in the batch row: spec 6.0 fixes them for the whole
  review, and the frontend needs the same numbers to describe a session. Agent decision.
- Phase three is not finished: the server's six end-to-end suites still drive the assignment flow and
  do not compile. They are the next piece of work, with the admin app's batch screens, which read the
  batch fields this phase renamed.

## The server (phase 3, part two)

- The queue serves in two tiers. First the conversations still short of their ratings, counting live
  reservations, so one reviewer's open conversation is never handed to another. Only when nothing is
  short does it serve one that already has its share, counting completed ratings alone — spec 6.0
  section 7's fourth rating, which is still useful. Ordering within a tier is coverage ascending,
  preferring a risk the reviewer has not met. Agent decision, replacing the single ordering the first
  part of this phase had, which let a reservation be served twice.
- A session's first conversation is served when the session is loaded, not when the tool asks: the
  tool mounts with what the session already holds, and an empty one would show a reviewer nothing.
  Agent decision.
- The import's practice rule counts the whole corpus rather than one file: a review has two practice
  conversations however many files they arrive in, and the per-file rule this phase started with made
  a staged import impossible, since practice ids cannot repeat. The upload now rejects a file that
  would leave more than two. Agent decision, superseding the file-level rule recorded above.
- A session past its closing date is not the reviewer's open session: they start another, as an
  assignment did. Agent decision.
- A session ends when the tool saves an export with `isDone`, which is after the feedback screen. A
  reviewer who closes the tab mid-session leaves it open, and the 24-hour release frees what it held.
  The old flow ended an assignment server-side once nothing was left to give; the member's Kora action
  now completes on that final save instead. Agent decision.
- `kora-review.service.ts` passed the 500-line limit, so the conversation allocation moved to
  `kora-review-allocation.ts`: serving, practice and attention scheduling, the budget test and the
  reservation. A codex subagent proposed that split together with one for the save path; the service
  is comfortably under the limit with the first alone, and the save path stays beside the session
  lifecycle it ends. Agent decision.
- The admin's batch preview now serves a reviewer's item rather than the stored conversation, so the
  preview shows exactly what a reviewer sees and the correct comprehension answer never leaves the
  server. The admin page itself and the generated client are the wiring phase's work. Agent decision.
- What the end-to-end suites assert changed with the rules above: a conversation is served again once
  it has its ratings, so "none left" now means the reviewer has seen everything, and the deletion
  impact of a batch counts the ratings a session made against it, which is every rating in that
  session. Agent decision.
- The generated API client is not regenerated in this phase. `bun run gen-api` reads the running dev
  server, which needs the AWS login this machine's session did not have, and the three mount sites
  that consume it — the frontend's review page and example page, and the admin's preview page — are
  the wiring phase's work anyway. They are the repository's only red spots: three type errors in
  `apps/frontend`, one in `apps/admin`, and the admin's preview-page test. Agent decision.

## Wiring the apps (phase 4)

- The API client was regenerated against a server run from this checkout rather than through
  `scripts/with-secrets.sh`, at the owner's instruction, since `aws sso login` was unavailable. The
  regenerated `sdk.gen.ts` and `types.gen.ts` carry the session endpoints, the preferences endpoint,
  `KoraItemDto` in place of `KoraTranscriptPreviewDto`, and the multipart upload's new fields.
- Two regenerations were needed. The first left the upload advertising `transcripts` and
  `transcriptsPerAssignment`, because the multipart body is declared in an inline `@ApiBody` in
  `kora-batches.controller.ts` that the phase-three rename had missed. Agent decision to fix the
  decorator and regenerate rather than hand-edit the client, which `apps/AGENTS.md` forbids.
- The admin keeps the shape it had: the same batch list, upload form, history, categories, notices
  and status control, with a session export page and a conversation preview page in place of the
  assignment export and transcript preview. The owner asked for minimal admin change in this phase,
  and the dashboard of section 12 is still deferred.
- The reviewer-facing and admin wording drops "pair", "transcript" and "assignment" for
  "conversation" and "session" everywhere a person reads it, including the empty states, the batch
  column headers, the deletion and retirement warnings, the notice copy, the project status
  confirmation and the Kora action's description. Agent decision: the words name what v6 actually
  serves, and leaving the old ones would have the admin describe a model the server no longer has.
- `KoraAdminCategoryDto.pairs` became `conversations`, with the SQL alias, the generated client, the
  admin column and its test following. It was the last server field still named for the A/B model.
  Agent decision.
- The shared query keys `koraAssignmentExport` and `koraRandomTranscript` became `koraSessionExport`
  and `koraRandomConversation`, matching the endpoints they cache. Agent decision.
- dupcheck reports `", which isn't in this session"` twice in `kora-export-check.ts`. The two
  messages reject different things — a rating for a conversation the session never held, and a skip
  of one — and each reads as a sentence where it is. Judged not worth extracting. Agent decision.

## The host screens (phase 4, part two)

- The six screens of spec section 14 run as one flow on the review route, not inside the participant
  sign-up form, even though 6.0 section 5 says "asked once at sign-up". Members never pass through
  that form, and the participants already on the waitlist completed it weeks ago, so a sign-up form
  question would reach neither group. Running the flow immediately before the first session also
  keeps "with each reviewer's consent" true, since consent is section 6's screen and now sits in the
  same flow. Agent decision; the departure from the spec's wording is the point worth reviewing.
- A new `KoraReviewPhase.Onboarding` gates the session. `state` and `more` both return it while the
  reviewer has no `consentAt` or no `onboardedAt`, so no session is created and nothing is reserved
  before consent — the lawful basis for the whole review.
- Each screen saves as it is passed, rather than one submit at the end, so leaving part way keeps
  the answers. Resume reads the two timestamps: consented sends the reviewer to the content warning,
  demographics answered to the risk opt-out, neither to the start. Agent decision.
- Demographics are one `jsonb` column with a zod schema beside it, not ten columns, following
  `server/AGENTS.md`. The questionnaire is written once and read once, by the export; nothing
  queries it, and KORA has already revised the bands between 5.2 and 6.0, so a revision should be a
  schema edit rather than a migration. Agent decision.
- `usRegion`, `childrenAgeBands` and `childAiUse` are cleared server-side when the answer they hang
  off goes away, so Annex D's "empty unless" rules hold whatever a client sends. The form clears
  them too, but the data owns the invariant. Agent decision.
- Only gender and household income offer "prefer not to say", as 6.0's table does; the other eight
  questions are simply skippable, which Annex D exports as empty. The form shows no option
  preselected and a "Clear this answer" control once one is chosen, so a skipped question and a
  declined one are never confused on screen either. Agent decision, replacing a first version whose
  preselected "No answer" read as an answer.
- The opt-out screen marks the risks the tool warns about, which is 10 — the taxonomy's 8 hard risks
  plus violence and fear, which an earlier task added. Marking the spec's 8 while the tool warns on
  10 would surprise a reviewer with an unmarked warning. Agent decision.
- `categories.ts` grew a `group` per risk and a `RiskGroup` enum, as section 14 asks. The eight group
  names are the Alliance's own sentence-case copy rather than the taxonomy's title case, per the root
  `AGENTS.md` capitalisation rule; the drift test checks the ids against
  `docs/kora/categories_and_risks.yaml` and leaves the names to the copy. Agent decision.
- `profileAnsweredAt` is dropped. The tool's profile left in phase two and nothing had read or
  written the column since, so this is the contract step for a shape already orphaned.
- The account page is a new route, `/projects/safer-chatbots-for-children/account`, and the tool's
  queue-empty screen (A11) now opens it instead of the project page. It edits the opt-outs and the
  opt-in through the preferences endpoint the wiring phase added.
- `CONTENT_WARNING` in `categories.ts` is deleted: the rebuilt tool renders its own hard-risk warning
  and had left that v5 copy unreferenced.
- The two rules a reviewer is held to are said both in the tool's guide and on the instructions
  screen, so they moved to `kora-review/src/copy.ts` and the host imports them. The same wording in
  two packages would drift the first time KORA revised it. Agent decision on a dupcheck finding.
- The Kora pages' chrome moved to `KoraPageShell`, which the review and account pages share. Agent
  decision on a dupcheck finding.

### Open, and owed by KORA

- The consent screen promises "a resources page is linked at the bottom of every screen". KORA has
  not supplied that content and no footer link exists, so the screen currently makes a commitment
  the product does not keep. Either the page arrives before review opens or the line comes out.
- The one-line risk descriptions for A2 are still owed; the opt-out screen shows the short labels
  from `categories.ts`, as section 18 anticipated.

## Serving KORA's test corpus

- The queue now serves `item_type: test` conversations everywhere except production, gated by the
  existing `koraStagingTools()`. Until this, the allocator asked only for scored, practice and
  attention, so a batch of the 88 test conversations validated on upload, showed 88 in the admin,
  and served nobody — the home page said "You're all caught up" to a reviewer who had judged
  nothing. Spec 6.0 section 11 asks for the platform "tested on the 88 by 28 November", which is
  impossible if they cannot be served, and Annex D's rule excluding `item_type = test` from the
  export only has work to do if they are rated. Production stays closed to them so a volunteer is
  never handed pilot material. Agent decision.
- P5 must hold up the other half of this: the five-table export excludes `item_type = test`. Ratings
  on the test corpus stay internal to the platform.
- Three places asked for servable conversations and each named `KoraItemType.Scored` itself —
  `start`, `offer` and the allocator. They now share `ratedCandidates`, so the next item type cannot
  reach two of the three.
- The home hero said "Review 0 conversations" whenever it offered a session, because an offer row
  carries no count and v6's session is a budget rather than a fixed number of conversations. The
  offer now reads "A session is ready" and the follow-on button "Another session", neither naming a
  count. Agent decision.
- "You're all caught up" was the hero's fallback for having nothing to offer, which also covers
  having nothing to give in the first place. A reviewer who has judged nothing now reads "Nothing to
  review yet"; the caught-up wording is kept for someone who has finished what there was.

### Still open

- An open session's heading counts the conversations the reviewer currently holds, which lazy
  assignment makes 1 at the start, so a resuming reviewer reads "Review 1 conversation" for a
  session that will run about 45 minutes. The count was right when a batch was assigned whole. Worth
  deciding what a resuming reviewer should see.

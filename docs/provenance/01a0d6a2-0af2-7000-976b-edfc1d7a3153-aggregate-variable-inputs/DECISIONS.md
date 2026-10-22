# Aggregate variable inputs

Status: implemented; see "As implemented" below.

## Delegated scope choices

The user explicitly requested that decisions about combining questions and eligible sources live here, rather than in REQUIREMENTS.

- Each aggregate input reads one multiselect question from one saved form. Multiple inputs cover multiple questions. Adding counts from separate inputs does not deduplicate members across questions; a combined unique-member count is outside this version.
- Allow any saved form selectable by the admin builder, including the destination itself. A new unsaved form must first be saved before selecting its own submitted-answer aggregate. Self-reference reads stored responses, never evaluates source variables, and therefore needs no recursive evaluation. The user permits dropping self-reference if it adds disproportionate complexity.
- Limit sources to multiselect questions, including questions inside layout groups, but not sub-fields of repeating lists. Include submitted history across form versions, with no date filters or combining forms. This covers the motivating action without a general aggregation query builder.

## Counting and formula contract

Compute aggregates on the backend. Return an object mapping stored option values to nonnegative integer counts, such as `{ "company-a": 12, "company-b": 0 }`. Include every configured option, even when its count is zero. Labels are presentation; formula lookup uses the stored value.

For each source form, exclude guest/anonymous responses and responses linked to withdrawal activities before selecting the latest eligible response per member. Order by creation time, breaking ties by response ID. Drafts are stored separately and never participate. An unanswered question contributes nothing; repeated values in one answer count once. Members are identified by the response's user relation, without an additional filter for their current contract or membership status.

A variable can combine the aggregate input with existing local or personal-history inputs. For example, an aggregate named `counts` and local dropdown input named `company` can use `company ? (counts[company.value] ?? 0) : 0`. The aggregate remains fixed during the open session while local answers update the formula immediately.

Assume stable question types and option values across submitted snapshots. Implement ordinary lookup against configured option values; migrations, reconciliation, and special guards or tests for option edits are unnecessary under the user's explicit undefined-behavior allowance.

## Loading and access

Batch aggregate inputs needed by a destination and deduplicate repeated form/question pairs. Fetch all options for a question together; selecting a company triggers no request. Several inputs reading one source should share its response selection and aggregation work. Start with computation on open, without polling or a persistent aggregate cache.

Authorize the destination and derive eligible aggregate sources from its configured schema on the server. Possession of a source form ID alone must not permit arbitrary count queries. Admin previews can evaluate draft configurations under admin authorization. Only option totals leave the backend, never underlying answers or member identities.

Guest viewers use the same aggregate data as signed-in viewers when they can access the destination; this differs from personal-history inputs, which are empty for guests. Member selection in an admin preview affects personal history but not these global counts. Formula samples use editable synthetic counts without requiring real responses.

Refresh counts for own completed-form views and admin reviews when opened. Do not store aggregate values in destination responses. Apply the existing source-loading failure behavior: loading gates a live form, transient errors provide retry, and deleted/invalid sources report an error rather than suggesting retry will fix them. Read-only reviews retain the saved response with affected variables unresolved and an error, following existing source-history behavior.

## Builder and compatibility

The aggregate mode offers a source-form picker, a single eligible-question picker, input type/help, and sample counts. Samples cover all option keys and allow nonnegative integers. Invalid references and invalid formulas block saving. Selecting aggregate mode must not change how existing answer inputs are interpreted.

Use a distinct stored input kind so builds that predate aggregates take the existing unknown-input failure path instead of interpreting an aggregate as a personal answer. Extend shared validation, typing, evaluation, interpolation, and loading for both web and mobile. Reject aggregate-variable references in shared output at save time and leave them unresolved at runtime if a stored schema bypasses validation; shared output never loads aggregates.

Extend source dependency discovery and the existing source-form deletion guard. A self-reference does not prevent deleting that same form; dependencies from other current forms do. Missing fields and unsupported kinds fail reference validation. Special protection against source question edits is outside the stable-schema assumption.

Use existing responses and their activity links. An additive input kind in form JSON should require no database migration or response backfill. Keep the duplicate-write fix separate; filtering withdrawals and choosing the latest submission must work with existing data.

The separate investigation is [ALL-1141](https://linear.app/worldalliance/issue/ALL-1141/investigate-duplicate-form-response-writes-around-withdrawal), filed with Bug and AI-generated labels. It distinguishes the observed extra response row from the unconfirmed cause of duplicate writes.

## Acceptance criteria

The feature is complete when focused tests and package checks establish:

- Synthetic repeated submissions use only the latest eligible one, including when its answer is empty; selecting several companies counts a member once under each selected company.
- Guests, drafts, and withdrawal responses contribute nothing. A newer withdrawal response does not hide an older eligible submission. A form with no eligible responses returns zero for every configured option.
- A configured multiselect with at least 140 options resolves in one aggregate payload. Repeated references share loading, and changing a local dropdown updates the displayed count without another fetch.
- Formula typing and preview support aggregate lookup alongside existing local and personal-history inputs. Invalid sample counts, references, and shared-output uses cannot be saved.
- Web, mobile, and admin views honor the approved loading, failure, refresh, and access behavior. Authorized guest viewers receive totals; unauthorized or arbitrary source queries cannot expose them or raw responses.
- Source deletion guards account for aggregate dependencies, existing variable kinds retain their behavior, and an unknown aggregate input fails visibly on an older evaluator.

Use synthetic fixtures only. Run the affected package tests and typechecks, plus targeted browser/mobile verification during implementation.

## As implemented

- **Stored shape:** `{ kind: "aggregate", sourceFormId, fieldId }`. The formula sees `{ [value: string]: number }`, with no per-submission array. `variableSourceFormIds` covers every stored form a variable reads, aggregates included, for validation loading and the builder. The deletion guard's jsonb path over `inputs.*.sourceFormId` matches aggregates because they store the same key. The history loader reads `variableHistoryFormIds` instead.
- **Self-reference:** the schema being saved validates the question, not the stored version it replaces, so a save can't remove the counted question or change its kind; that would save a broken aggregate reference. The builder's question picker still lists the saved version's multiselects, because counts come from stored questions: a question added in this save can be picked once the form has been saved with it, matching the spec's "save first" rule.
- **Endpoints:** `GET tasks/variableAggregates/:formId/snapshot/:formSnapshotId` (optional auth) counts the aggregate inputs of a version in the form's snapshot history. "Authorize the destination" is read as the form's existing access: anyone can read any form at `tasks/slug/:id`, so the endpoint doesn't check the viewer. What it counts is limited instead: the server derives the questions from that version, so a caller can't name them, and reopened responses keep counting what their own version reads. A version outside the form's history returns 400. `POST tasks/variableAggregates` is admin-only and counts any questions, for previews and reviews. Both return `{ aggregates }`, one `{ sourceFormId, fieldId, counts }` per question, with `counts: null` when the form is deleted or unreadable, or the question is gone or no longer a multiselect.
- **Counting:** each form takes one SQL query shared by all its questions: `DISTINCT ON ("userId")` ordered by `createdAt DESC, id DESC`, after excluding guest rows and responses linked to a `user_wont_complete` activity through `taskFormResponseId`. Values that aren't current options are dropped.
- **Client:** `useVariableAggregates` makes one request per open form, keyed by the target and the de-duplicated questions. An admin preview refetches when its set of counted questions changes. A non-admin renderer without a saved snapshot, such as a static task form, reports counts as unavailable instead of zeros. Web and mobile gate through `variableInputsGate`, which merges this status with source histories. The deleted-source message now names a question as well as a form.
- **Sample counts:** they are builder-local and never saved, so "invalid samples can't be saved" is read as a visible preview error. An invalid count, or no question picked yet, makes the input read as `undefined`.
- **Verification gap:** the web renderer and admin builder were exercised in unit tests and in the browser. The mobile renderer shares the hook and gate logic and passes typecheck, but was not driven in a simulator.

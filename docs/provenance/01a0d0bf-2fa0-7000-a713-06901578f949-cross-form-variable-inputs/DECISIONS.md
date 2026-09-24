# Cross-form variable inputs

This is a specification, not an implementation record. Product approvals are recorded in [REQUIREMENTS.md](REQUIREMENTS.md); the design choices below are agent-authored.

## Value contract

An external input adds a submission dimension to the existing local value conversion. Keeping the existing conversion preserves scalar, choice, city, and list-row behavior while making history predictable.

| Source question        | No submissions | One submission                        | Multiple submissions                            |
| ---------------------- | -------------- | ------------------------------------- | ----------------------------------------------- |
| Number                 | `[]`           | `[5]`                                 | `[5, undefined, 8]`                             |
| Choice                 | `[]`           | `[{ label: "Option A", value: "a" }]` | One choice record or `undefined` per submission |
| Multiselect or ranking | `[]`           | `[[choice1, choice2]]`                | One choice array or `undefined` per submission  |
| List                   | `[]`           | `[[row1, row2]]`                      | `[[], [row1]]`                                  |

The identifiers in the table denote synthetic choice/row records. Existing blank-value conversion applies inside each submission. Preserve empty positions rather than filtering them: formulas may combine two fields by their submission index. Positions align only within the same source form.

Order responses by creation time, then response ID, both ascending, so simultaneous submissions have deterministic positions. Reuse one ordered response set for every input referencing that form. Return values to formulas, without adding response metadata or a configurable response selector.

“This form” retains live local-input semantics; it does not expose the destination's previous submissions. Source references identify a form and question by stable IDs. List inputs retain their per-input sub-field aliases. Read stored source answers through their response snapshots without recursively evaluating source variables; forms referencing each other's answers therefore do not create an evaluation cycle.

## Retrieval and lifecycle

Fetch the complete authorized response history with the snapshots needed for conversion. Existing previous-answer displays and conditions select a single response, so preserve their semantics when sharing retrieval infrastructure. Pagination or batching may be internal, but must not silently truncate the formula's history.

Authenticate member history requests from the session. An admin-only path may select a member for preview/review. A guest or a synthetic preview without a selected member receives empty history; it must not fall back to the admin's own responses. Private answers may be read in these authorized contexts, independently of whether the member marked them public.

Keep the fetched history fixed for the open destination and recompute formulas against that history as local inputs change. Reopening or reloading fetches fresh history. A change of destination or preview member discards the previous context; late requests cannot populate the new context with another member's answers.

Represent loading, successful empty history, and failure separately. Gate form display and submission until required histories load successfully. Retry reloads failed sources. Limit this new gate to forms using external inputs so unrelated previous-answer features retain their behavior.

## Authoring and shared output

The source field picker lists question kinds the existing variable system can read. Keep local formulas and input shapes compatible. External types wrap the selected question's existing value type in an outer array; the preview supports adding/removing sample submissions and, for list questions, sample rows within each submission. Formula help should show the extra array dimension and the possibility of missing answers.

Validate external references and formula types on save through the normal builder/server validation boundaries. Inspect every text location shared output renders after interpolation, including reused question labels, when rejecting references to variables with external inputs. This avoids exposing private source answers indirectly through a label.

Enforce the same boundary at runtime for stored or bypassed schemas: shared output must not fetch another form's history or evaluate an external input as an empty successful result. Leave the affected variable unresolved through the existing output error behavior. Other output variables remain usable.

## Discretionary edge cases

The user said the following cases can be assumed not to happen. They accepted the agent's recommendations only if they are not too complicated and explicitly requested that these choices live in DECISIONS, not REQUIREMENTS.

- **Question type changes between submissions:** Prefer preserving each snapshot's value type and showing the possible types in the formula editor. Reuse existing union-type support if practical. Avoid building a historical schema catalog solely for this case; an explicit unsupported-type error is an acceptable simpler fallback. Never silently reinterpret an old answer using a newer type.
- **Question removed from the current source form:** Prefer continuing to read historical answers from response snapshots while flagging the reference and requiring repair before another builder save. If supporting that distinction requires disproportionate machinery, fail explicitly rather than substituting another question or silently dropping history.
- **Source form deleted:** Prefer a load error because deletion also removes its responses. Use the normal failure path rather than recovery infrastructure.

These are implementation discretion, not release acceptance requirements. Record any simpler choice and its reason here during implementation.

As implemented:

- **Question type changes:** REQUIREMENTS lets the implementation ignore this case. Each answer is read with its own snapshot's field kind. When a snapshot reads the question (or a named list sub-field) as a different input mode than the source form's current version, the variable fails with an unsupported-type error. The formula editor still shows only the current type; a union catalog across snapshots was not built.
- **Question removed:** runtime keeps reading each submission's snapshot, so an open form still works. Builder and server validation reject the reference, so the next save needs a repair.
- **Source form deleted:** the server refuses to delete a form while another form's current version reads it, and names those forms. The user chose this guard when asked during review, over the spec's normal-failure-path preference. A source deleted anyway, one only older versions read, makes the history endpoint return 404. A form being filled in says the form it reads was deleted and offers no retry, since a retry would fetch the same 404. A read-only render, such as an admin reviewing an old response, still shows the response, with the variables reading the deleted form unresolved, the way shared output leaves a variable it can't resolve. Validation reports the form as missing. The guard and a save that starts reading the form take no lock, so two admins deleting and saving in the same instant can still leave a form reading a deleted one. It then behaves like any other deleted source; locking the save path wasn't worth it for a race that needs two admins at once.

## Implementation choices

- **Stored shape:** an input reading another form is a `sourceField` or `sourceList` input, with a required `sourceFormId` bounded to a Postgres integer. `field` and `list` keep reading this form, so stored schemas need no migration. The separate kinds make a build that predates them fail the variable as an unknown input kind; an optional id on `field` would be ignored there, and the old build would read this form's answers instead.
- **Stored answers:** history answers are read with `readStoredFormAnswers`, which accepts a city saved with keys since dropped. The strict schema new submissions use rejects those, and it rejected 61 of 6,538 responses in a local copy of staging data.
- **Unreadable questions in old versions:** a question an old version holds but that no longer parses, such as a radio whose options repeat a value, is read with the current version's definition, so its answer isn't read as blank. Two snapshots in a local copy of staging data hold such a question, across 11 responses. If its kind, or a list sub-field's kind, has changed since, the history fails to load instead of reading the answer as the new kind.
- **Endpoints:** `GET tasks/myResponseHistory/:id` reads the session's member; `GET tasks/responseHistory/:formId/user/:userId` is admin-only. Each returns the source form's current schema plus every submitted response (`id`, `answers`, `schemaSnapshot`), ordered by `createdAt`, then `id`. Each response embeds its snapshot rather than de-duplicating snapshots: members rarely submit a form many times, and one flat shape is simpler to parse.
- **One request per source form:** the client fetches each source once per subject, so every input reading that form shares one ordered list. A source form added while the form is open, once the others have loaded, fetches only itself; one added while another is still loading refetches that one too. Retry refetches only the forms that failed.
- **Subject:** web and mobile renderers read the signed-in member's own history. An admin renderer reads the selected member through the admin endpoint. A guest, or the builder's synthetic "preview" user, gets empty history without a request. An admin preview id that isn't a user id never falls back to the admin's own answers.
- **Stale responses:** loaded histories are keyed by subject. A response for an earlier key is dropped, and history does not refetch while the key stays the same.
- **Missing history fails:** a resolution context without a source's history fails the variable ("not loaded") rather than reading `[]`. That is how shared output leaves the variable unresolved: output resolution never passes histories.
- **Validation context:** `validateFormSchema` takes `{ formId, sourceForms }`, the current page-level question fields of every source form. The server loads them from the database, and the builder loads them through the form-fields query cache. Reading the form's own id as a source is rejected, since "This form" never exposes the destination's earlier submissions.
- **Shared output:** every output view counts as shared output. The check covers display blocks, field-block label overrides, and the referenced question's label, description, placeholder, option labels, and list sub-field text, matching `interpolateFieldText`.
- **Conflict merge:** `mergeFormSchemas` validates with the same context. The builder loads source forms referenced by either its own schema or the conflicting server schema.
- **File splits:** variable evaluation (`variable-evaluation.ts`), variable validation (`variable-validate.ts`), the input schemas (`variable-inputs.ts`), the variable field scope (`variable-scope.ts`), and the builder's sample editors (`VariableSamples.tsx`) moved into their own files. Their parents had passed the 500-line guideline.

## Compatibility and storage

Use existing submitted responses and snapshot records; no response backfill or new copy of external answers is planned. An additive source reference in variable input JSON should allow existing local inputs to keep their behavior without a data migration. Confirm this during implementation rather than rewriting stored schemas preemptively.

Keep formula output restrictions unchanged: arrays are inputs for calculations, not a new renderable result type. Unsupported inputs and calculation failures use the existing form error behavior. This feature does not add guest history lookup, cross-member computation, live history polling, or history support to visibility conditions and previous-answer display blocks.

## Acceptance checks for implementation

- Exercise zero, one, and multiple submissions with skipped scalar and list answers, including equal submission timestamps and multiple inputs from one form. Assert exact values and alignment.
- Verify snapshot-specific option labels and list aliases, combinations of local and external inputs, and unchanged local-only formulas.
- Verify ownership restrictions, selected-member admin previews/reviews, synthetic preview and guest emptiness, draft exclusion, and complete history retrieval.
- Verify loading and retry on web and mobile, including member/context switches and late responses. Confirm a new source submission appears after reopen/reload but does not alter an already open form.
- Verify builder source selection, multiple sample submissions, nested list samples, reference/type errors, and save rejection for external variables in every shared-output interpolation location.
- Verify shared output never fetches external history and leaves forbidden external variables unresolved even if a stored schema bypasses save validation.
- Verify read-only member forms and admin reviews use current source history rather than a copy from the destination's submission date.

The spec is complete when the approved choices are represented and the discretionary edge cases remain explicitly separate. Implementation is complete only after the checks above and the affected packages' required checks pass.

# Formula choice options

Specification only; implementation has not been requested. [REQUIREMENTS.md](REQUIREMENTS.md) records the user's request and approvals. The design below is agent-authored; implementation details may change while preserving those requirements.

## Authoring and result contract

Offer fixed options or an options formula in the admin editor for `select` and `multiselect`, including list sub-fields. Reuse the existing formula input picker, expression editor, type feedback, and sample evaluation. Show evaluated choices in the preview so authors can inspect labels, values, and deduplication.

An options formula returns an array of `{ label: string, value: string }` records. This matches existing choice inputs and avoids converting a list to display text and parsing it back. Check this result type in the builder and validate the actual result at runtime. `[]` is a valid empty result; `undefined`, scalar results, nested arrays, and malformed records are errors. Authors explicitly supply empty fallbacks where inputs may be unanswered.

Keep text variables' existing output contract. Reuse the formula engine with a separate options result contract rather than permitting array-valued text interpolation. An options formula has its own inputs and expression; it does not require a named text variable.

Reuse existing input semantics, including source lists and local inputs. Prior-response inputs expose submitted history in its existing order and preserve labels from each response's form snapshot. Source drafts are excluded. Formula expressions choose submissions, flatten lists, concatenate sources, transform values, or add literal choices. There is no separate latest/all selector, union configuration, or implicit addition of the fixed option list.

For a multiselect history input named `input1`, the authoring help should include:

| Purpose                           | Expression                                          |
| --------------------------------- | --------------------------------------------------- |
| Latest submission's selections    | `input1.at(-1) ?? []`                               |
| Selections across all submissions | `input1.flatMap(answer => answer ?? [])`            |
| Latest selections from two inputs | `(input1.at(-1) ?? []).concat(input2.at(-1) ?? [])` |

These are examples, not a default history policy. Source history already supplies snapshot labels; formulas may replace them deliberately. Formula options initially carry labels and values, without importing source categories. Fixed options retain their category behavior.

## Resolution and interaction

Deduplicate by exact stored value, preserving the first label and position. Case differences remain distinct. Equal labels with different values remain separate. Apply existing option randomization after deduplication; search and multiselect selection limits operate on the resolved choices.

Resolve the same choices for rendering, answer cleanup, required checks, submission validation, and choice inputs consumed by other formulas. Evaluate dependencies consistently; reject self-dependencies and cycles as configuration errors rather than oscillating between option sets. List sub-fields use the existing formula input scope, without introducing a new implicit current-row variable.

Load prior history once for the open form and member. Local-input formulas recompute when their inputs change, using that fixed history. Reopening or reloading fetches fresh history. Changing the preview member discards the previous member's context. A guest or preview without a selected member inherits the existing empty-history behavior.

Loading is distinct from an empty result: gate the form until its sources resolve. Source retrieval errors offer retry; invalid formulas, malformed results, and deleted or incompatible sources block the form with a visible error. Never replace an error with an empty list or fall back to fixed options.

For an empty list, disable the field and display “No options available.” Existing visibility and conditional-required rules determine whether an unanswered field prevents submission; hidden fields do not acquire a new requirement. Preserve a default only when it is a valid resolved choice, and never automatically select the sole available option.

On draft restoration, resolve options before checking saved answers. Clear an unavailable select value; for a multiselect, remove only unavailable values. Apply the same cleanup when local inputs change the available choices. An emptied answer stays empty rather than restoring a default. Repeat this behavior for list sub-fields.

## Submission and saved responses

Validate submitted selections on the server against the formula's resolved options for the submitting member. Reject forged values and malformed formula results. Enforce required and maximum-selection rules after existing hidden-answer handling, including list sub-fields.

Keep source history fixed through submission as well as display: the server needs a verifiable reference to the history used by the open form, not a client-provided option list it blindly trusts. Additional source submissions must not silently replace that context. If the original context can no longer be verified, return an explicit refresh error rather than substituting current history. The transport and storage mechanism is an implementation choice.

Persist the selected values and their resolved labels with the destination response, including enough field/row identity for repeating lists. Keep the existing scalar/array answer shapes so answer consumers retain their value contract. Response-specific label metadata belongs with the response, not in the shared form definition. Persist only selected choices, avoiding disclosure of unselected private source answers.

Use saved labels for completed form display, admin review, shared output, and subsequent formula reads of these answers. These paths must not depend on refetching the original source history or on the viewer's identity. Existing answer visibility rules govern access. Later source edits, new submissions, or deletion must not relabel a completed destination answer.

Existing fixed-option schemas and responses require no backfill. Add formula configuration compatibly, and add response metadata with an empty/absent legacy state. A schema migration may be needed for that metadata; choose the exact shape during implementation. Legacy responses continue resolving labels through their saved form snapshots.

## Boundaries

Authoring remains admin-only. Member rendering covers web and mobile, and admin preview uses the selected member. This feature does not add cross-member computations, guest history retrieval, live history polling, radio/ranking destinations, or new source-category semantics. Existing previous-answer display and visibility-condition history policies remain separate.

## Acceptance checks

Implementation is complete when the following behaviors pass focused tests and the affected packages' required checks:

- Builder configuration, sample preview, save/load, invalid result types, and invalid references work for both destination kinds and list sub-fields; fixed-option forms retain their behavior.
- Latest and all-submission formulas produce the expected choices for zero, one, and multiple submissions, including unanswered fields, unions across forms, source lists, and literal choices.
- Duplicate values keep the first label and position; different values sharing a label remain distinct; transformed values can prevent a collision. Search, randomization, defaults, and selection limits use resolved choices.
- Web and mobile distinguish loading, empty, failed, and ready states; optional/required and hidden-field behavior matches the contract. Retry and preview-member switches do not leak stale choices.
- Local-input changes and reopened drafts clear invalid selections without dropping valid multiselect values or reinstating defaults. Dependency cycles fail visibly.
- Server checks reject out-of-set submissions and enforce limits and required fields, including repeating lists. A new source submission during an open form does not change its validation context.
- Completed responses retain chosen labels through source changes or deletion, in member display, admin review, shared output, and downstream formulas. Shared output exposes only permitted selected answers and needs no private source-history request.

Spec completion requires all approved choices to be represented, agent decisions to remain distinguishable from user-origin requirements, and both documents to pass formatting and sensitive-data review. Implementation checks above are pending implementation.

# Decisions

## A new field kind, not a display block or a builder preset

A new `conversation` kind in `anyFieldSchema` (`common/src/forms/field-schemas.ts`), named "Conversation Field" in `FIELD_KIND_NAMES` and addable in the builder. It is an input, since it records an answer, and one kind keeps the expert, options, replies and note together on the canvas. A preset expanding into a Quote block, a radio field, conditional text blocks and a textarea would reuse more code but could not draw the options inside a chat bubble, animate the reply, or keep the pieces together when an admin moves them. (agent decision)

## Schema shape

Base field properties plus:

- `expert`: `{ userId, userName, userProfilePicture }`, snapshotted when picked, as the Quote block's `userId`, `userName` and `userProfilePicture` are (`common/src/forms/display-blocks.ts`). A snapshot needs no extra lookup when the form renders; a later name or picture change shows only after the admin re-picks. The schema allows `null`, so a field just added in the builder parses before an expert is picked, and form validation (`conversationFieldErrors` in `common/src/forms/conversation.ts`) refuses to save a form whose conversation has none, along with one that has no message or fewer than two options. (agent decision)
- `message`: markdown string, rendered with the existing form markdown renderer and `#{name}` variable interpolation, as Text blocks are. (agent decision)
- `options`: each `{ label, value, reply?, note? }`, where `reply` is markdown and `note` is `{ required?: boolean, placeholder?: string }`; the presence of `note` turns the note box on for that option. Values stay unique, as `optionListSchema` enforces. (agent decision)
- `noteId`: the answer key for the note, set to `<field id>_note` by the builder when the field is created and checked by form validation not to match any field id or another conversation's note id. (agent decision)

Out of the first version, since nothing asked for them: `randomizeOptions`, options formulas, categories, use as a list sub-field, and several expert messages (the last per REQUIREMENTS.md). (agent decision)

## Answer storage

The choice is stored at `answers[field.id]` as the chosen option's value string, the same shape a radio answer has, and the note at `answers[field.noteId]` as a string. `FormValue` and the stored answer schemas stay unchanged, so no expand-migrate-contract step is needed for answers, and installed mobile builds still parse every response. Because the choice is radio-shaped, the radio branches in statistics, filters, exports, visibility conditions and formulas (`apps/admin/src/lib/fieldStatistics.ts`, `responseFilter.ts`, `responsesHtmlExport/responses.ts`, `apps/admin/src/components/form-fields/conditions/`, `common/src/forms/variables.ts`) extend to `conversation` by adding it beside `radio`, satisfying the radio-like responses requirement. The alternative, an object value `{ choice, note }`, would need a new `FormValue` shape, an expand-migrate-contract rollout for installed mobile builds that parse answers, and its own branch in each of those places. (agent decision)

The second key costs one change wherever answers are handled one key per field, so each goes through `fieldAnswerKeys` or `conversationsByNoteId` in `common/src/forms/conversation.ts`: the server's draft allowlist (`server/src/tasks/form-draft.service.ts`) keeps the note; `stripHiddenAnswers` (`common/src/forms/visibility.ts`) strips it with a hidden conversation; `answerField` (`shared/forms/formValueUpdater.ts`) clears the conversation's error once a typed note satisfies it; and the web and mobile form renderers pass the note's value and setter to the field beside its own. Output views and an activity's outputs map answers to fields by id, so they leave the note out, which keeps a note private by default. (agent decision)

A note left after an option with its note box on stays in the member's in-progress answers, so switching back restores it, but `stripHiddenAnswers` drops it from the effective answers while the chosen option shows no note box. A draft keeps the in-progress answers, as it keeps a hidden field's. A submission sends the effective answers, and the server strips what it's sent the same way, so a submitted note always belongs to the submitted choice. (agent decision)

## Required note

`required` covers the choice. The note is required only while the chosen option's `note.required` is true; that check goes in `shared/forms/fieldValidation.ts` beside the field's other checks, so web and mobile share it, with "Please add a note." as its message. The server checks it on submission too (`server/src/tasks/form-submission-validation.service.ts`), as it does a required field. (agent decision)

## Rendering

- Web in `sharedweb/forms/RenderField.tsx`, mobile in `apps/mobile/components/forms/RenderField.tsx`, both reusing the Chat Transcript block's grey left bubble for the expert (`sharedweb/forms/RenderDisplayBlock.tsx`, `apps/mobile/components/forms/RenderDisplayBlock.tsx`), with each of the member's options an accessible radio (a `radiogroup` on web, radio roles on mobile) so it works with keyboards and screen readers. (agent decision)
- The member's options card keeps a chat bubble's shape on the right: rounded, with a tighter bottom-right corner. The chosen option's radio circle gains a filled dot, so its state shows by shape as well as by the green tint. (agent decision)
- The typing dots last one second (`EXPERT_TYPING_MS` in `shared/forms/useExpertTyping.ts`, shared by web and mobile). Reduce-motion is read with `prefers-reduced-motion` on web (`sharedweb/lib/reducedMotion.ts`) and Reanimated's `useReducedMotion` on mobile. Reopening a saved draft shows the reply for the saved choice straight away, with no dots, since the dots answer a pick the member just made. The reply sits in a polite live region so screen readers announce it. (agent decision)
- The note box is a textarea under the conversation labelled "Your note", with "(optional)" when the note is not required, and the option's `placeholder`. It shows once the dots stop. (agent decision)
- Output views show the choice's label only, like a radio field. The admin responses table, CSV and HTML exports add the note as a column of its own after the choice, labelled "<field label>: note", through `withConversationNoteFields`. (agent decision)

## Builder

The admin builder gets an editor for the kind in `apps/admin/src/components/form-fields/`: the expert picker reused from `EditableQuoteBlock.tsx` (extracted to a shared component at this second caller), a markdown editor for the message, and per option a label, an optional reply, and a note switch with "Required" and placeholder inputs. The canvas preview draws the conversation as the member sees it; replies and note settings are edited in the settings sidebar. The Quote block now uses the extracted picker, `apps/admin/src/components/UserPicker.tsx`. (agent decision)

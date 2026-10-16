# Split shared/formrenderer.ts under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file. Two cohesive groups move into `shared/forms/`, with their unit tests and unchanged bodies:
  - `fieldValidation.ts`: `validateFieldValue` and `getListSubFieldErrors`.
  - `formDrafts.ts`: what a renderer starts a draft from: `computeFormStorageKey`, `resolveFieldDefaultValue`, `applyDefaultValues`, `filterAnswersByFieldIds`, `restorableAnswers`, `restorablePublicAnswers`.
- `formrenderer.ts` keeps page navigation, unknown-kind schema checks, and display-block helpers.
- Consumers import moved functions from their new modules. `formrenderer.ts` does not re-export them, as in the earlier `shared/lib/messages.ts` split; a re-export layer would leave two import paths for one function.
- Moving validation alone leaves the file at about 450 lines, under the limit but with little room, so the draft helpers move too. Finer splits (navigation, schema checks, display blocks into their own files) are left out: the remainder is under 300 lines.
- The waiver goes in the commit that takes the file under 500 lines, so no commit carries an unused directive.

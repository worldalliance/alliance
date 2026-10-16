# Split FormBuilder under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Assignment

- The orchestrating agent assigned this waiver so parallel agents work on separate files.

## Split

- The fix the waiver asks for is splitting the file. `FormBuilder` was one 2,000-line component, so the split pulls out pure schema helpers first, then the hooks and components the component composes:
  - `lib/copyWithUniqueIds.ts`: unique ids, and the page and element copies that remap references to the copied ids.
  - `form-fields/createField.ts`: each new field kind's defaults, beside `createDisplayBlock` for blocks. List sub-fields keep their own `createDefaultSubField`, whose labels and defaults differ.
  - `lib/updatePageElement.ts`: an element update, carrying an option value rename into the conditions that read it.
  - `lib/useSavedForm.ts` and `lib/useFormSave.ts`: the saved baseline (load, dirty tracking, navigation guards) and saving with its conflict actions. The conflict state lives with the baseline because the formula source forms must load for the other side's schema before saving can be validated.
  - `FormBuilderHeader.tsx`, `FormBuilderPreview.tsx`, `FormBuilderSettings.tsx`, `FormBuilderCanvas.tsx`: the header and banners, the preview as a user, the settings sidebar, and the canvas workspace.
  - `form-canvas/useCanvasSelection.ts` and `form-canvas/useCanvasEdits.ts`: the canvas selection, and the edits that change the schema and move the selection with it.
  - `FormDraftContexts` builds its context values from the form draft; `useFormulaSourceValidation` derives source-form status; `useSaveGate` holds Save's checks and confirmation.
- Each extraction keeps behavior as it was and lands as its own commit that typechecks and passes the admin tests alone. The last commit removes the waiver.
- Behavior changes made along the way, each named in its commit: an unknown field kind throws instead of adding nothing, and the preview's user list loads only for the preview that shows it.
- The preview's chosen user and the per-user content override stay in `FormBuilder`, so switching tabs or leaving preview keeps them as before.

## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split. Rendered output and draft, navigation, submit, and withdraw behavior stay the same.

## Layout

All new files sit beside `FormRenderer.tsx` in `apps/mobile/components/forms/`.

- `RenderDisplayBlock.tsx`: `RenderDisplayBlockMobile` with the accordion and chat transcript, the boundary web already has in `sharedweb/forms/RenderDisplayBlock.tsx`. `DisplayOnlyRenderer` and `OutputRenderer` import it from there instead of from `FormRenderer`.
- `ImagesDisplay.tsx`: the image carousel and its slides. Web keeps them inside its `RenderDisplayBlock`; on mobile the paging and per-slide measurement would leave that file near the limit rather than well under it.
- `WithdrawalModal.tsx`: the withdraw modal, owning the selected option and reason it alone reads.
- `useFormDraftState.ts`: the answer, public-answer, and page state with their AsyncStorage restore, save, and clear on submit, the server-draft reconciliation, and the public-answer defaults. It composes the existing `shared/forms/formDrafts` helpers and `useFormDraftSync` rather than reimplementing them; web's draft logic reads `localStorage` synchronously during initial state, so the two stay separate.
- `FormNavigation.tsx`: the editable footer and the read-only paging, as presentation; `FormRenderer` decides what each button does.
- `OutputPublicToggle.tsx`: the per-output-field share checkbox.
- `pageNavigation.ts`: next, back, read-only paging, and the validation that decides whether Complete submits or moves the member to another page. A plain function rather than a hook, since it holds no state, so it is unit tested without a renderer.
- `FormPage.tsx`: the current page's elements: per-member block resolution, visibility, video neighbour spacing, and display blocks. `FormRenderer` passes `renderField`, so the field's many inputs stay where they are computed.
- `deviceType.ts`: the device-type detection both `FormRenderer` and the submission hook read.
- `useFormSubmission.ts`: the submitting state, submit, and withdraw. One payload builder holds the fields a submission and a withdrawal share. The submission and withdrawal payloads stay mobile-only; web builds its own beside browser focus and analytics handling.

## Testing

Mobile tests run under bun with no DOM or React renderer, and `react-native` is mocked globally in the preload, so the moved components and hooks have no unit tests; the split moves them without changing their logic. `pageNavigation.ts` is plain logic and gets `pageNavigation.test.ts`.

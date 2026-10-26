## The hook

`useCreateFormAdmin` joins `shared/lib/useFormsAdmin.ts`, which already owns the forms cache and the delete write. It is a separate hook rather than a field of `useFormsAdmin` so callers that only create a form don't also load the index.

A new form has no cached field lists or response counts, so a create invalidates only the index (`queryKeys.formsAdmin()`), not every forms key.

## The callers

Each create goes through the hook and drops its own invalidation:

- `useFormSave`: updates keep their raw call, 409 handling, and full invalidation; only the create moves. A refused create now throws into the save's existing catch, which logs it. That catch's fallback copy becomes "Could not save form", so a refused create and a refused update read the same.

## Out of scope

Form updates (`tasksUpdateFormAdmin` in `useFormSave`) and the single-form read in `useActionCommands` (`tasksGetFormAdmin`) also touch forms data but aren't the assigned target; they stay as they are.

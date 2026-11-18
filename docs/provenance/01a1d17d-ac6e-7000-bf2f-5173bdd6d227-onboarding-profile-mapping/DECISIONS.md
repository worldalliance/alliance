# Decisions

- **The completion subtitle is `completionSubtitle` on the form schema**, edited in the admin's Output views editor, where the completion card's contents are configured. (agent decision)
- **`form-schema.ts` was split** into `field-schemas.ts` (field definitions) and `form-value.ts` (answer values), re-exported from `form-schema.ts`, before adding to it, per the file-size rule. (agent decision)

---
user: Charles Lien
task: Work out which expand-migrate-contract step the deprecated `text` form input field is in, and label it in code with a BACKCOMPAT marker.
---

# Requirements

- Mark the `text` input field schema (`kind: "text"`, `type: "input"`) in `common/src/forms/field-schemas.ts` with `BACKCOMPAT(text-field)`, saying it is superseded by `textarea` and is removed once no form snapshot holds a `text` input. (agent-proposed, user-approved)
- Point the `text: false` entry of `FIELD_KIND_ADDABLE` in `common/src/forms/element-descriptors.ts` at the same tag. (agent-proposed, user-approved)
- The `text` display block (`type: "display"`, `kind: "text"`) is a different element and stays unmarked. (agent-proposed, user-approved)

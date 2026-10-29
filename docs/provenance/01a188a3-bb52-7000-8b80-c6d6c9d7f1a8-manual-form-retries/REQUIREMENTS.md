---
user: Charles Lien
task: Reload a failed load only when the user retries
---

## User-origin requirements

- A load that fails in the UI reloads only when the user presses its retry control: never through automatic retries, nor when the browser tab regains focus or the network reconnects.
- This holds for the open-form loads in `shared/forms/useVariableAggregates.ts` (aggregate counts) and `shared/forms/useVariableSourceHistories.ts` (answers from other forms), on web, admin, and mobile, including a source form that was deleted.
- A refactor keeps an existing retry control and its manual trigger rather than replacing it with automatic retries.
- The agent instructions state this as a guideline.

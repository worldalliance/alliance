## The caches

`useActionReporting` stays the one hook the dashboard reads its reports through. Its own loads move into queries keyed by action id: `queryKeys.actionStatsByIdAdmin`, `queryKeys.actionShareUrlStatsAdmin`, and `queryKeys.actionIncompleteUsersAdmin`. Keying by id means a response for an action the admin has left lands in that action's cache entry instead of the screen, which fixes ALL-1662.

The task form and its responses already had owners: `useTaskForm` holds `queryKeys.taskForm`, and `useFormResponsesAdmin` holds `queryKeys.formResponsesAdmin`. The reporting hook reads the form through `useTaskForm` and the responses through `formResponsesAdminQuery`, the options `useFormResponsesAdmin` now exports, so both hooks define that cache once. It doesn't call `useFormResponsesAdmin` itself, which would also load the form's share links the overview never shows.

## Gating

Invite stats load only for a public-only action, as before. The overview shows the withdrawn and dismissed counts, the response statistics, and the users who failed to complete only once the member action has started, so their loads now wait for that too: the action stats and the form responses load only then, and the incomplete users only then, only for a required action (the card is hidden for an optional one), and only for a status in `office_action`, `resolution`, `completed`, `failed`, `abandoned`, as before. That set is now a `Record<ActionStatus, boolean>`, so a new status has to be opted in or out. The task form loads regardless, since the Details tab's readiness checklist reads it. A gated list reads empty while its gate is closed, even with a list cached from when it was open.

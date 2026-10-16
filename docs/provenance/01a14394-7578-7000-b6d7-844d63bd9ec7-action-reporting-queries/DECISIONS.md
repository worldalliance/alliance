## The caches

`useActionReporting` stays the one hook the dashboard reads its reports through. Its own loads move into queries keyed by action id: `queryKeys.actionStatsByIdAdmin`, `queryKeys.actionShareUrlStatsAdmin`, and `queryKeys.actionIncompleteUsersAdmin`. Keying by id means a response for an action the admin has left lands in that action's cache entry instead of the screen, which fixes ALL-1662.

The task form and its responses already had owners: `useTaskForm` holds `queryKeys.taskForm`, and `useFormResponsesAdmin` holds `queryKeys.formResponsesAdmin`. The reporting hook reads the form through `useTaskForm` and the responses through `formResponsesAdminQuery`, the options `useFormResponsesAdmin` now exports, so both hooks define that cache once. It doesn't call `useFormResponsesAdmin` itself, which would also load the form's share links the overview never shows.

## Gating

Invite stats load only for a public-only action, as before. The overview shows the withdrawn and dismissed counts, the response statistics, and the users who failed to complete only once the member action has started, so their loads now wait for that too: the action stats and the form responses load only then, and the incomplete users only then, only for a required action (the card is hidden for an optional one), and only for a status in `office_action`, `resolution`, `completed`, `failed`, `abandoned`, as before. That set is now a `Record<ActionStatus, boolean>`, so a new status has to be opted in or out. The task form loads regardless, since the Details tab's readiness checklist reads it. A gated list reads empty while its gate is closed, even with a list cached from when it was open.

## Failures

The old loaders logged a failure to the console and left the section empty. A query's error has no console line, so the hook reports `failedLoads`, naming each load that failed with nothing to show while its report is on the overview, and the overview tab shows them in `FailedLoadsBanner` above the reports. A failed background refetch keeps the reports it has on screen and stays out of the banner, as `useFormResponsesAdmin` treats it. A server error or network failure retries under the admin client's default policy first.

`FailedLoadsBanner` (`apps/admin/src/components/FailedLoadsBanner.tsx`) comes out of FriendGraphPage, so the "Could not load …" wording and look are written once. InviteGraphPage carries a third copy; a concurrent run is changing that page, so moving it onto the component is left to a follow-up.

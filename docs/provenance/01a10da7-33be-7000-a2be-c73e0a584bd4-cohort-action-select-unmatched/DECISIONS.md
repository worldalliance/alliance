# Unmatched cohort action conditions: decisions

ALL-1401 (agent-filed): a `CompletedAction` / `MissedActionDeadline` condition whose saved action isn't in the loaded list reads "Select action...", as if unset, both when `/actions/all` failed to load and when the action was deleted.

- `ActionSelectEditor` adds a disabled option for the unmatched id labelled "Loading actions…", "Couldn't load actions", or "Deleted action". It and `TagEditor` render that option through one `UnmatchedOption`, so the two keep the same wording; the tag loading label moves from "..." to "…" to match.
- On load failure, the condition select's placeholder reads "Couldn't load actions", like the compare select's, so an unset condition doesn't read as an empty but working list.
- An id of 0 (a new condition) or `NaN` (`parseInt("")` after picking the placeholder) counts as unset, matching the select's existing `value.actionId || ""`.
- `CohortExpressionBuilder` takes an `actionsError` flag next to `actionsLoading`, mirroring `tagsError`. `ActionDashboard` feeds it from `useAllActions().allActionsLoadFailed` through `ActionForm` and `ActionFollowUpFormsTab`.
- The compare select has no saved value, so it only gets the placeholder change.
- The dashboard's load-failure banner names cohort conditions alongside prerequisites, as the issue suggests.

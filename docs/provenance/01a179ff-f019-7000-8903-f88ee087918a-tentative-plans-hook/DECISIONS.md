## Which cache

The tentative plans get their own cache, `queryKeys.reminderTentativePlansAdmin(eventId, group)`, owned by `useReminderTentativePlansAdmin` in `apps/admin/src/lib/`. They answer an unsaved draft, as the email and text previews in `useReminderPreviewsAdmin` do, so they key on the draft body rather than join `useActionReminderGroupsAdmin`, whose caches hold saved groups by event and group id, or `useScheduledPlansAdmin`, which lists the next week's plans across all events. The hook sits in its own file because it carries a debounce the preview hooks don't.

## No invalidation from reminder-group writes

`tentativePlansForGroup` on the server builds an unsaved group (id 0) and asks `findPlansForGroup` for its cohort, minus members already sent a notif and members away. Creating, updating, or deleting a saved group changes none of those inputs, so `useActionReminderGroupsAdmin`'s writes leave this cache alone. What can change the count (completions, sent notifs, away ranges) happens outside the admin form; the hook covers that by refetching each time the form returns to a draft (below), not by invalidation.

## Behavior kept from the form's effect

- The request waits until the draft holds still for 300ms, and a burst of edits sends one request. An edit that settles back on a draft whose count failed (a character typed and deleted) asks again, as the effect did on every edit.
- Until the count answers the latest draft, the form shows "Counting recipients…" and, when `waitForRecipientCount` is set, holds submit. A count being refetched (on reconnect, say) is withheld until the fetch finishes, because it may predate a completion or a sent notif, and it backs the submit confirmation.
- `gcTime: 0`: each draft the form pauses on gets its own entry, holding one plan per recipient with the recipient's user. The form never shows a count from cache, so an entry leaves with its observer rather than holding member data for the admin's one-day `gcTime`. The effect likewise kept only the latest list, until the form unmounted.
- No retry and no refetch on window focus: the form never retried or refetched on focus, the Retry button asks again, and a focus refetch would hold submit again.
- `networkMode: "always"`, as in `useSearchResults`: offline, TanStack would pause the fetch, which reads as a finished fetch, so a new draft would count forever with no Retry. Fetching anyway fails at once and shows the error with Retry, as the direct call did.
- A tag cohort without a tag, or an invalid relative window, counts as zero without a request; no event counts as unknown. These stay in the form: they are the form's validation, not the cache's.
- A count that arrives clears the form's local error, as before.

## Error copy

A refused count reads through `adminRefusalMessage`, the admin's shared refusal copy (#730): the server's message for a 4xx, the fallback "Unable to get tentative plans" for a network failure, a 5xx, or anything without a status, and the session-expired copy for a 401. A network failure used to show the browser's text ("Failed to fetch").

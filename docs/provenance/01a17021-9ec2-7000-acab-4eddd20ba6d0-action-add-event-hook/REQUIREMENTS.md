---
user: Charles Lien
task: Add an admin action's events through the named useActionAdmin hook
---

## User-origin requirements

- Everything that touches a query cache lives in a single named hook. That hook may call several endpoints that share the cache.
- Find code that should go through a named TanStack Query hook but doesn't: a generated `sdk.gen.ts` function called outside react-query, or a raw `useQuery` in a component outside a named hook. Complete one such hook.
- The changes go in standalone commits.

## Assigned target (agent-proposed, by the orchestrating agent, not the user)

- The admin `CreateEventForm` adds an event to a single action with a raw `actionsAddEventAdmin` call. Adding an action event moves into `useActionAdmin` (`shared/lib/useActionAdmin.ts`), which owns the admin action cache (`queryKeys.actionAdmin`), so the write refreshes that cache.
- Staff are still asked to confirm before an added event moves assigned members' deadline earlier, and the event is resent acknowledged only when they confirm.
- What the form's callers did by hand to refresh the action after an add goes away once the hook refreshes it.

# Decisions

- `useActionAdmin.addEvent` returns the raw client result instead of throwing, because the deadline-shortening confirmation (`sendConfirmingDeadlineShortening`) reads the 409 status off the response. The confirmation stays in the admin app: it needs `useToast` from `sharedweb`, which `shared/` can't import.
- `addEvent` invalidates the action and the all-actions list only when the server returned data. The all-actions list carries each action's `events` and `status`, which an added event changes; the forms index carries neither, so it is left alone. A refused add (409, other errors) leaves both caches untouched.
- The refetch replaces the form's hand-built `setAction({ ...action, events: [...] })` and `useActionAdmin.setActionFromDto`, its only caller. `addEvent` awaits the invalidation, so the form reports success after the refreshed action is in the cache.
- `ActionDashboard` passes its own `useActionAdmin` instance's `addEvent` down through `EventManagementTab` as `addToAction`, mirroring suite mode's `addToSuite`; a second hook instance in the form would need an action id the suite branch doesn't have.
- Without the action write, `CreateEventForm` read nothing from its `action` prop in either mode, so the prop goes, along with `SuiteEventList`'s `referenceAction`, which existed only to feed it.

## One cache for both platforms

`useNotificationsCache` moves from `apps/mobile/lib` to `shared/lib`, and web reads and writes notifications through it. `NotificationsProvider` goes away; what stays web-only (navigating on click, analytics, the bell's preview size) lives in `apps/frontend/src/lib/useNotificationActions.ts`, which writes only through the cache.

The move lands alone first, so the web change reads as a diff against the code mobile already ran.

## Limited and whole lists

The bell and the home updates row show the latest 20; the notifications page shows them all, as before. Each is its own query under `queryKeys.notificationsList(limit)`. Marking read updates every cached list, and counts a notification down once however many lists hold it. With an unread count not yet cached, a mark leaves it uncached instead of deriving it from one list, since a limited list undercounts.

The provider used to swap the bell onto the whole list while the page was open, and guarded the races that sharing one list between two loads created. Separate queries have no such races, so the provider's race tests go with it; the bell now keeps its 20 while the page shows all.

Each list keeps its own load time under `queryKeys.notificationsLoadedAt(limit)`, and mark-all takes the limit of the list it was clicked from, so it is bounded by the load time of the rows on screen. One shared slot would let the bell's later load bound the page's mark-all and mark rows the page never showed.

## Errors

Web's client returns refusals instead of throwing, and mobile's throws. The cache passes `throwOnError: true` on each call so `markRead` rejects and `markAllRead` restores on a refusal on both. Web used to keep its optimistic read after a refused mark-all; it now restores, as mobile does. A refused single read is logged, as on mobile.

## Marking content read on view

`Comments` and the shared `ActionUpdateCard` marked content read only inside `NotificationsProvider`, which only the member app mounts. `Comments` is member-app only and already requires a signed-in user. `ActionUpdateCard` also renders in admin, so it takes `marksNotificationsRead`, which admin's updates tab turns off, keeping an admin's preview from marking their own notifications read.

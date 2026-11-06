---
user: Charles Lien
task: Fix ALL-1943, ALL-1944 and ALL-1942 in one PR, all in the notification cache, without changing ALL-1934's behavior.
---

# Requirements

All user-originated, one commit per issue, each with its `Fixes ALL-XXXX` line.

- ALL-1943: `markCachedReadByContent` (`shared/lib/useNotificationsCache.ts`) refreshes the unread count through `refreshIn`, as `markRead` and `markAllRead` do, so a first count load in flight is cancelled and replaced rather than joined. A unit test holds the first count load, calls `markCachedReadByContent`, releases the load with the pre-read count, and expects the server's newer count.
- ALL-1944: `markRead`'s refusal path and `markAllRead`'s refusal and success paths refetch the lists unconditionally and the unread count only when that write's `trackCountDown` check passes; `markAllRead` keeps the check `trackCountDown` returns. A unit test seeds notifications 1 and 2 with count 2, holds the read of 1 (the server count drops only once it is released), has read-all answer 500, awaits `markAllRead()` with `useUnreadNotificationCount` mounted, and expects the idle count to read 1. The DECISIONS.md Notifications bullet on count refetches in the normalized-actions task stays accurate.
- ALL-1942: `shared/lib/notificationIdentity.test.ts` builds its records with `const notification = (overrides: Partial<NotificationDto> = {}) => makeNotification({ id: 1, contentId: 10, ...overrides });` from `shared/lib/testFixtures.ts`, dropping the copied fields.
- A failed mark-all-read still restores reads made while it was pending (ALL-1934 stays as recorded).

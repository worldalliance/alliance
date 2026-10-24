## The hook

`useUnreadMessageCount(config)` in `shared/lib/useUnreadMessageCount.ts` owns `queryKeys.conversationUnreadSummary()`: it fetches `conversationGetUnreadSummary`, keeps `totalCount` (unread messages plus message requests, what the badge showed before), and opens the `/messaging/overview` socket whose `conversation:unread` event invalidates the key. It takes the messaging connection config because the socket needs each app's URL and auth; `createMessagingHooks` binds it as `useMessagingUnread`, so callers keep the import they had and get the count back as a number, as `useUnreadNotificationCount` returns its count.

## Writes

After a change to a conversation, the server emits `conversation:unread` to each of its remaining participants: a new message, mark-read, accepting a request, membership changes. The hook refetches on it, so mark-read and accept touch nothing.

A viewer who declines a request or leaves a group is no longer a participant by the time the server emits, so gets no event for their own count. `useMyConversations`' `declineInvite` and `leave` call `refreshUnreadMessageCount`, exported beside the hook so the key stays in one file, once the server accepts the write. A member an admin removes also gets no event, and made no write to hang a refresh on; that needs the server to notify them (ALL-1808).

`useLiveConvoMessages` marks a conversation read through `useMyConversations({ load: false }).markRead`, the mark-read the Messages screens already call, instead of its own raw `conversationMarkRead`. `useCommunityConversation` keeps its own mark-read, since it stores the returned conversation in the group's chat cache.

## Behavior

- Web: the navbar hides the Messages badge on the Messages page, as before. The count now refetches on each socket event there too; before, it was zeroed on that page and refetched once on leaving.
- Mobile: the tab bar refetched on every socket event before and still does.
- Declining a request or leaving a group refreshes the count on both platforms. Before, only web did, and only on leaving the Messages page.
- A failed fetch logs on each attempt and, once the app's query retries are spent, leaves the badge at its last value (0 before the first load). Before, an HTTP error response went unlogged and only a network failure logged.

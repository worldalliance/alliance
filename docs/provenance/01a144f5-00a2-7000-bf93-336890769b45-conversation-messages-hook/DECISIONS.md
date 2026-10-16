## The cache

`useConversationMessages` (`shared/lib/useConversationMessages.ts`) caches one conversation's messages under `queryKeys.conversationMessages(conversationId)`, loaded with `messageGetMessages`. Keying by conversation lets every screen showing the same conversation share it, and a conversation opened again shows what was cached while it reloads.

The hook carries no socket. Each platform's `useLiveConvoMessages`, built by `createMessagingHooks` with that platform's socket config, joins the conversation's room and hands each `message:new` to the hook's `receiveMessage`, so the merge rule lives in the hook. `useLiveConvoMessages` keeps calling `onIncomingMessage` and marking the conversation read only for a message the cache did not already hold.

## Writes during a load

A message heard while the messages load is replayed over the load's result through `writesDuringLoads` (`shared/lib/writesDuringLoads.ts`), the rule `useMyConversations` uses for its list, extracted so both share it. A socket message for a conversation with nothing cached and no load running is dropped, which matches the screens before: they showed nothing for a conversation until its messages loaded.

An unconfirmed message shows at once, even before the messages load, as before, and is not replayed over a load, since the load may already hold its sent copy. It is taken back from the conversation it was added to, which the hook remembers by its `temp-` id, since the screen may have moved to another conversation by the time the send fails.

## Loading and failure

`staleTime: 0` reloads on every mount, as the screens did, since the socket keeps the messages current only while a screen shows them. A failed load still shows an empty conversation, as before: the load logs the failure and resolves to an empty list, so writes recorded during it replay over that list and messages heard during or after it still show. Resolving rather than throwing also means a failed load is not retried, as before. Making the failure visible is a separate change.

## Out of scope

`useLiveConvoMessages` marks a conversation read with `conversationMarkRead` on each incoming message, and `useMessagingUnread` loads the unread count with `conversationGetUnreadSummary`. Neither touches the messages cache.

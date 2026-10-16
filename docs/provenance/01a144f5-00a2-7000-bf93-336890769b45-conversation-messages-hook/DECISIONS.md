## The cache

`useConversationMessages` (`shared/lib/useConversationMessages.ts`) caches one conversation's messages under `queryKeys.conversationMessages(conversationId)`, loaded with `messageGetMessages`. Keying by conversation lets every screen showing the same conversation share it, and a conversation opened again shows what was cached while it reloads.

The hook carries no socket. Each platform's `useLiveConvoMessages`, built by `createMessagingHooks` with that platform's socket config, joins the conversation's room and hands each `message:new` to the hook's `receiveMessage`, so the merge rule lives in the hook. `useLiveConvoMessages` keeps calling `onIncomingMessage` and marking the conversation read only for a message the cache did not already hold.

## Writes during a load

A message heard while the messages load is replayed over the load's result through `writesDuringLoads` (`shared/lib/writesDuringLoads.ts`), the rule `useMyConversations` uses for its list, extracted so both share it. A socket message for a conversation with nothing cached and no load running is dropped, which matches the screens before: they showed nothing for a conversation until its messages loaded.

An unconfirmed message shows at once, even before the messages load, as before. It is also replayed over a load in flight, and `sendMessage` removes it once its sent copy is shown, in case the load already held that copy. It is taken back from the conversation it was sent to, since the screen may have moved to another by the time the send fails.

## Loading and failure

`staleTime: 0` reloads on every mount, as the screens did, since the socket keeps the messages current only while a screen shows them. A failed load still shows an empty conversation, as before: the load logs the failure and resolves to an empty list, so writes recorded during it replay over that list and messages heard during or after it still show. Resolving rather than throwing also means a failed load is not retried, as before. Making the failure visible is a separate change.

## Sending

`sendMessage` sends through `sendOrExplain`, so a failure is logged and reported. Given the viewer's profile, it first shows the message as unconfirmed under a `temp-` id, its reply target taken from the cached messages, and removes it if the send fails. The socket's copy of the message still replaces it, as before. The send's own response is not written, since `useLiveConvoMessages` updates the conversation list only for a message the cache did not already hold; once the send succeeds, the unconfirmed copy is removed only if the sent copy is already shown, as when a load already held it.

The author shown on the unconfirmed message is still built by each screen from the signed-in user; sharing that is a separate change.

## Out of scope

`useLiveConvoMessages` marks a conversation read with `conversationMarkRead` on each incoming message, and `useMessagingUnread` loads the unread count with `conversationGetUnreadSummary`. Neither touches the messages cache.

## The cache the writes share

Each of the five endpoints returns a `ConversationDto` that belongs in the viewer's conversation list, which `useMyConversations` (`shared/lib/useMyConversations.ts`) caches under `queryKeys.myConversations()`. The pages merged each result into that list through the hook's `setConversations`, so the writes join the hook's existing conversation-info writes rather than a sibling hook.

## Writes

The hook returns `createDirectConversation`, `createGroupConversation`, `acceptInvite`, `declineInvite`, and `markRead`, each resolving to `Result<ConversationDto, Explanation>` through `sendOrExplain`, like the hook's other writes. A request that throws no longer surfaces as an unhandled rejection, and a failure is logged and reported.

A started chat is added to the list, or replaces the copy the list holds, and the list is re-sorted, as both pages did. Accepting and declining merge the returned conversation, as `handleConversationUpdated` did.

`markRead` sends the read and returns its result without writing the list. The server answers a read by pushing `conversation:unread` over the overview socket, which `useConversations` already merges into the same list, so a second writer for the unread state would only have to agree with it. It is a stable `useCallback` because both pages call it from an effect keyed on the open conversation.

The pages keep their behavior on failure: the web page keeps the new-chat pane open and leaves an invite in place, and mobile's chat screen leaves an invite in place. Mobile's new-message screen already alerted on a failed create; it now shows the explanation's title and message instead of "Could not create conversation."

## Out of scope

`useLiveConvoMessages` in `shared/lib/messages.ts` marks a conversation read on each incoming socket message and discards the response; `useCommunityConversation` marks a group chat read into its own cache. Neither is called from the assigned files.

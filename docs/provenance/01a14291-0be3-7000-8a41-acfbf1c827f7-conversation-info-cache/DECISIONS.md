## The cache the writes share

The four writes return the updated conversation, which belongs in the viewer's conversation list. That list lived in `useState` inside each `useConversations` call, so every mounted screen held its own copy and no TanStack cache existed for the writes to share. `useMyConversations` (`shared/lib/useMyConversations.ts`) now owns the list under `queryKeys.myConversations()`, and `useConversations` keeps only the overview socket, which writes through the hook. On mobile the list, chat, and info screens stay mounted together in the stack, so they now see one list.

The query sets `staleTime: 0` because the overview socket keeps the list current only while a messaging screen is open; mobile's default five-minute `staleTime` would otherwise show a list that missed changes while no messaging screen was mounted. Every mount reloads it, as each `useConversations` call did before. It doesn't reload on window focus, which the old code never did; the socket keeps a mounted screen's list current.

A reload that fails, after its retries, is logged and keeps whatever list the cache holds, since the cache is shared and blanking it would also wipe screens whose list was fresh. The hook reports `reloadFailed`, judged against the time of the last successful reload because any write through `setQueryData` clears the query's error, and the web chats sidebar and the mobile messages list show "Couldn't refresh" with a retry above the list, so a cached list, up to a day old on web, doesn't pass as current. MessagesPage doesn't act on `?to=` against a list whose reload failed. With nothing cached, a failed load still shows "Could not load conversations" as before.

`loading` follows `isFetching`, as the old per-screen flag did, so a screen opening a conversation the cached list lacks, such as one a push notification opens, shows its spinner until the reload lands instead of "Conversation not found."

Each mounted screen still opens its own overview socket, and each merges every unread payload into the one list. So that the result doesn't depend on which socket hears a payload last, the screens share the set of conversations any of them has open, and every merge zeroes the unread count of any conversation in that set.

Any screen's mount, and on web a regained window focus, reloads the shared list, so a socket merge or write can land while another screen's reload is in flight. That reload may have read the list before the write. Every write through `setConversations` is also recorded against each reload in flight and replayed over its result, rather than restarting the reload, which a steady stream of socket updates would keep from ever landing.

The web cache outlives MessagesPage and may predate the conversation a link names. MessagesPage acts on `?to=` only once the list's reload has landed, and while it reloads, a `?chat=` the list lacks shows a spinner in the chat pane rather than "No chat selected".

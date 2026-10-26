## The group

The member's friends. `userFriendListFriends` already has a cache, `userQueryKeys.friends(userId)`, owned by `useUserFriendsQuery` in `shared/lib/user.ts`, and every friendship write (send, accept, remove) invalidates it there. The loader read the same endpoint around that cache. The page now reads it through that hook rather than a new admin one, so the endpoint has one owner.

Notifications and form submissions stay in the loader with their lint disable. Neither endpoint has a cache or a write anywhere, so each would be a new hook of its own rather than part of this one.

## The hook

`shared/lib/user.ts` exports `userFriendsQuery(userId)`, the key and fetch `useUserFriendsQuery` already used, so the admin loader can prefetch the same cache entry. The admin page passes `loaderPrefetchStaleTime` as the hook's `staleTime`; `shared` cannot import it from the admin `QueryClient` module.

## The section

The friends section moves into `components/user-detail/UserFriendsSection.tsx` with `FriendRow`, since it now owns its query, as the tags and actions sections do. It shows loading and failed-load states, per the root `AGENTS.md` rule to fail loudly, where an error response used to show as no friends and a network error failed the whole page. It says it could not refresh when a reload fails over friends it already shows. Both states come from `SectionQueryState.tsx`, which the actions, tags and notification settings sections share first in a commit of their own, so the page's sections read alike.

## Loading

The loader prefetches the friends through `prefetchFromLoader` without awaiting, as it does the member, the action relations and the tag summaries.

## The hook

`useUserDetailAdmin` already owns the member's cache (`queryKeys.userDetailAdmin(userId)`) and the other writes to the same `user/userdetail/:id` resource: roles, contract suspension and tag membership. The deletion joins it as `deleteAccount` rather than getting a hook of its own, which would put a write that ends the member's cached detail outside the hook that owns it.

`DeleteAccountModal` takes the mutation's `mutateAsync` from the page in place of the member id, as the page's other sections take the hook's writes. It keeps its own deleting state: the modal stays in "Deleting…" until the page closes it, where the mutation's pending flag would clear first.

## What a deletion refreshes

The server soft-deletes the member and cascades to their forum posts and comments, action activity (so completion counts drop), messages, notifications and event-log history, and deletes their group memberships, likes, tags and co-authorships. That reaches nearly every admin cache: the users list (`useUsersAdmin`), the graph, group membership and contact info, tag summaries, posts, action and analytics stats, form responses. A list of keys would miss whichever one the next feature adds, so a successful deletion invalidates every cached query.

Active queries refetch at once, so the sidebar's badges, which stay mounted across navigation, drop the member too; the rest reload the next time something mounts them, such as `useUsersAdmin` on the members list the page navigates to. The mutation doesn't await the refetch, so the page navigates away before the member's own queries land as 404s; a 404 isn't retried. A caller that stays on the page shows "Member not found", which is accurate.

## The upload

`imagesUploadImage` stays a direct call with the lint disable reworded to the wording other upload callers use: its key is held in the modal's state and sent with the deletion, and nothing caches it.

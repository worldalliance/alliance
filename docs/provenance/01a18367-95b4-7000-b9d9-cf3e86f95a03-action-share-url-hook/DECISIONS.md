## Target

No `named-hooks-only` exemption is marked TODO any more, so the target came from exemptions whose reason doesn't hold. `actionsGetActionReferralCode` is a POST, but the server's get-or-create returns the same code for a member and action until an admin deletes it, so its answer is cacheable data, not a one-off write.

## The hook

`useActionShareUrl` in `shared/lib/` returns the function `buildActionShareUrl` was, with the same parameters, so web and mobile keep building URLs the same way. It caches the code under `queryKeys.actionReferralCode(actionId)` through `queryClient.fetchQuery`, so the request still goes out only when a member shares. A query that fetched on render would create a share URL for every action card a list shows.

A cached code is fresh for an hour (`staleTime`), and kept that long (`gcTime`) because nothing observes the query between shares. The server returns the same code every time unless an admin deletes the member's share URL, after which it mints a new one; the old code then no longer resolves. An hour lets repeat shares within a visit skip the request while bounding how long a deleted code keeps going out. Signing out removes every query but the member's own, so the next member doesn't see the previous one's codes.

It doesn't retry: a share waits on the request, and the apps' default backoff would hold the copy for seconds. A failed request still gives the plain URL, as before, and now logs, so a broken endpoint that quietly costs members their referral credit shows up. `throwOnError` keeps the failure out of the cache, so the next share asks again.

`use*.ts` files are exempt from `named-hooks-only`, so the hook carries no lint disable, and `shareText.ts` no longer imports the client.

## Web

`apps/frontend/src/lib/actionShare.ts` becomes `useCopyActionShareText`, binding the site URL. `ActionItemCard` copied the bare URL. It now uses the same hook with no template, since `buildShareText` returns the URL alone in that case, so `actionShareUrl` goes.

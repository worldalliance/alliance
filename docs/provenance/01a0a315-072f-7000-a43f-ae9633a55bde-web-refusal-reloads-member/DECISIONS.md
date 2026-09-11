# Decisions

## Reload the member after a refused disconnect

The rows already disable a Disconnect that would remove the last way in, so the server only refuses a disconnect when the member changed after the page loaded. For example, another tab disconnected the other provider. Before this change, the row showed the refusal next to a provider the server no longer had, and nothing reloaded the member until a page reload. Now `handleUnlink` calls `refreshUser` after a 400, so the rows show what the server has.

Only a 400 reloads the member. After a 401 the fetch wrapper has already tried a token refresh and fired `auth:unauthorized`, and a second `/auth/me` would try again and fire it again. A 5xx says nothing about the member.

The reload is awaited inside the `try`, so every Disconnect stays disabled until the fresh member arrives. Otherwise the member could click the stale Disconnect in the meantime.

Rejected: reloading only when the refusal is `LastSignInMethod`. The endpoint returns a plain `BadRequestException` with no code, so that check would depend on the message text.

## Not fixed here

- Mobile settings (`apps/mobile/components/OAuthAccountLinks.tsx`) doesn't reload the member after a refused disconnect either. That code belongs to the commit that adds mobile settings, which gets its own review.

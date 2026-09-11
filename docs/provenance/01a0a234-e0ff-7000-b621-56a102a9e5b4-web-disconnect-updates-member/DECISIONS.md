# Decisions

## Take the member from the disconnect response

`DELETE /auth/:provider/link` already returns the updated member, so the settings row passes that to a new `setUser` on AuthContext instead of calling `refreshUser`. There is no second request, so there is no failed reload to explain to the member.

Rejected: making `refreshUser` throw when `/auth/me` returns no data. That fixes the cause for every caller, but about ten callers in `apps/frontend` use it, several without `await`, and each would start raising unhandled rejections. That change reaches well past this commit.

Rejected: keeping `refreshUser` and checking the member afterwards. That still costs a second request, and it can't tell a failed reload apart from a server that didn't unlink.

## `setUser` takes only the member

The unlink response is an `AuthMeResponseDto` built without `isImpersonation`, so `setUser` replaces the member and leaves the impersonation flag alone.

## Not fixed here

- Impersonation sessions can link and unlink providers. This predates the commit and is filed as ALL-1072.

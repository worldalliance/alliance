## Target

No `named-hooks-only` exemption holds a raw call that a cache should own, so the target came from cache access outside the owning hook. `InviteSession.tsx` was the only file outside `useInvite.ts` that touched `queryKeys.referrerProfile` or `queryKeys.onetimeInvite`.

## The hook

`useInvite` returns `forgetLookups`, which removes both lookups for the code it was given. `InviteSessionProvider`'s drop calls it where it removed them itself, so the provider no longer reads the query client or the query keys.

The provider passes `useInvite` no code while a member is signed in, so `forgetLookups` then removes nothing, where the provider removed the lookups for its code. Nothing reads them in that state: the provider's own lookup is disabled, and they'd be stale only for a later signed-out visit, which starts after sign-out has removed every query but the member's.

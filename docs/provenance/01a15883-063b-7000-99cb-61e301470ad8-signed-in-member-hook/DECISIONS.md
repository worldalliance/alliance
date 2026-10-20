## The cache

`shared/lib/useMe.ts` replaces `meQuery.ts` and owns the `["authMe"]` query. The query now holds the whole `/auth/me` response rather than only its `user`, so web's `isImpersonation` is read from the same cache instead of from component state.

Both `AuthProvider`s read the member from that query through `useMe`, rather than keeping a copy in `useState`. That ends the two copies drifting apart: before, linking or unlinking a sign-in method in settings updated the query but not the member `useAuth` returned, and `refreshUser` updated `useAuth` but not the query. `refreshUser` keeps its name and contract for its many callers.

`AuthProvider` reads without fetching (`enabled: false`), so it only changes when a session starts, ends, or something refreshes the member, as before. Settings' sign-in methods keep their own enabled observer, and refetch on focus as they did.

## Writes

Every write goes through `meCache(queryClient)` in the same file: `fetch` (always hits the server, records failure on the query), `refresh`, `set` (a member another endpoint answered with), `invalidate`, `startSession`, and `clear`.

`fetch` does not retry, as the direct `authMe` calls it replaces did not: web's launch tries a token refresh on the first failure, and the query client's retries would hold the launch behind their backoff.

`startSession` and `clear` replace the providers' `queryClient.clear()`. `queryClient.clear()` removes the member's query object, and a mounted `useQuery` keeps reading the removed object until its component renders again, so `useAuth` could keep returning the previous member. Both instead drop every other query and all mutations and keep the member's query object. `clear` (logout, and mobile sign-in, which loads its member outside the cache) resets it in place, which notifies its observers. `startSession` (web login and `onLogin`) leaves the current member showing until the new session's member arrives, as the provider's `useState` did, so signing up never flips the member to signed out and back; it cancels a load already in flight, whose answer belongs to the previous session.

The settings form loads the member through `fetch` instead of writing the cache itself. A failed load leaves the query in its error state rather than removing it, which still keeps sign-in methods from showing an earlier visit's connections, and keeps the member signed in.

Onboarding loads the member after registering through `fetch`, so `useAuth` shows the new member as signed in from then on, as it already does after an OAuth sign-up, rather than only once `onLogin` runs after the agreement is signed.

`refresh` backs `refreshUser` on both platforms. Its callers await it right after an action the server already accepted (joining a group, signing the agreement), so a failed reload must not surface as that action failing; it logs and keeps the current member. Reporting it to analytics is ALL-1722.

`fetch` shares a load already in flight, so the settings form loads again when the answer belongs to a different member than the one it is seeding.

## Out of scope

`apps/mobile/lib/session.ts` calls `authMe` while opening and restoring a session; its 401 handling and token bookkeeping belong to the session, so it stays, and the provider writes the member it returns into the cache with `set`. Admin's `AuthContext` signs in an admin, a separate app and cache.

## Filter at the server, not the frontend

`findAllMembersPublic()` in `server/src/user/user.service.ts` already filters the public members list
by `hasActiveContract` before it reaches the client. Added `user.profilePicture !== null` to the same
`.filter()` call rather than filtering client-side in `MemberDirectory` (`apps/frontend/src/pages/static/PeoplePage.tsx`),
so the `/users/members-public` API never exposes members without a picture, matching the existing
visibility-filtering pattern (`shareInfoPublicly`, `hasActiveContract`) instead of adding a second,
inconsistent filter layer in the UI.

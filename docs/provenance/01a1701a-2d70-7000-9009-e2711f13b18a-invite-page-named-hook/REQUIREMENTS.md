---
user: Charles Lien
task: Move code that should use a named TanStack Query hook onto one
---

## User-origin requirements

- Everything that touches a query's cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called outside TanStack Query or a raw `useQuery` in a component, and complete one hook for it. The hook shares one query cache and may cover several endpoints.
- Land the changes as standalone commits.

## Agent-proposed requirements

- Target (chosen by an agent): the frontend invite page (`/invite`, `apps/frontend/src/pages/static/InvitePage.tsx`) loads the inviter's profile and the onetime invite through `useInvite` (`shared/lib/useInvite.ts`) instead of raw `userReferralReferrerProfile` / `userOnetimeInviteOnetimeInvite` calls into component state.

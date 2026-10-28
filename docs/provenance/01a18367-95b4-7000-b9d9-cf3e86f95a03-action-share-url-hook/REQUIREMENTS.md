---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `buildActionShareUrl` in `shared/lib/shareText.ts`, used by the web share buttons (through `apps/frontend/src/lib/actionShare.ts`) and the mobile action task panel, calls `actionsGetActionReferralCode` from a plain async function on every share, under a lint exemption claiming no cache holds its result. The member's referral code for an action moves into a TanStack query, keeping the share URLs, the plain-URL fallback for signed-out visitors and failed requests, and the fetch on share rather than on render.

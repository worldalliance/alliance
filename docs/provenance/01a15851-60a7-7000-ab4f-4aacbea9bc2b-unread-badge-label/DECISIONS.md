# Decisions

- The helper is `formatBadgeCount` in `shared/lib/badgeCount.ts`. The name avoids shadowing the mobile tab bar's local `badgeLabel`, and covers the Tasks badge, which counts to-dos rather than unread items.
- The web side nav and mobile tab bar previously capped at "99" (`Math.min(count, 99)`), added in ab75ef751. Nothing in history or `docs/provenance/` records that cap as a product choice; `01a12b39-…-mobile-task-badges` only kept the existing cap. Moving both to "99+" is the intended behavior change.
- Per-conversation unread badges (`apps/frontend/src/components/MessagesSidebar.tsx`, `apps/mobile/components/messages/ConversationListItem.tsx`) show the raw count with no cap. They stay out of scope: they have no cap to unify, and capping them would be a separate product change.
- The bell badge in `NotificationsIcon.tsx` had a fixed `w-5.5` that could not fit "99+" within its padding, so its width becomes `min-w-5.5`. It already showed "99+" before this change, so the fix is a separate commit.

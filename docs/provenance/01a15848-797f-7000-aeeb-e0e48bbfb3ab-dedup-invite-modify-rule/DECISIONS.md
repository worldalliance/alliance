## Decisions

- **Same policy, confirmed.** `docs/provenance/01a12ec5-1b00-7000-bcc4-1dbfc643d647-invite-manage-policy/DECISIONS.md` (#574) records the rule for one-time invites as "the inviter, or anyone who may manage the invite's group", and #443 moved both invite deletes onto `canManageCommunity` together. The community-invite delete is the same rule written inline.
- **Home.** `canModifyInvite` lives in `server/src/community/invite-permissions.ts`, taking `{ invitingUserId, communityId }` so either invite entity fits. `user.entity.ts`, beside `canManageCommunity`, is already past 500 lines.
- **`canModifyOnetimeInvite` stays** as a thin wrapper: its two callers share the loaded-relation check on `invitingUser`, which the community invite has no helper for.
- **Each endpoint keeps its own refusal.** One-time edit keeps 400 `Invite belongs to someone else`; both deletes keep their bare 400.
- **Share-URL invites stay separate.** `updateInviteForUser` and `deleteInviteForUser` allow the link's owner only: a share URL is the caller's own reusable link, not a group's invite, and group targeting is leader-only by #574's decision.
- **Out of scope.** `removeUserFromCommunity` and `deleteCommunity` checking leadership only is a separate rule; #574 recorded it as intentional (admins have their own endpoints).

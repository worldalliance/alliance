# Decisions

## Target

`GroupDetailPage.tsx` (820 lines) was picked from the remaining `alliance/max-lines` waivers because no other open branch or worktree touches it.

## Split

The page splits along its features, the option `codex exec` recommended. New files live in `apps/admin/src/components/group-detail/`:

- `GroupSettingsForm.tsx`: the details card with its draft, its reseeding on refetch, validation, and the update mutation.
- `useGroupMembershipChanges.ts`: member and leader selections, adding and pending state, the membership mutation, and the leader promotion confirm. Promotion and leader removal share one pending set, so one hook owns both cards' changes.
- `GroupMembership.tsx`: the members and leaders cards and the member info table, which share the sorted member and leader lists.
- `GroupDetailPage.tsx`: route lookup, loading and not-found states, the header, the shared error banner, and deletion.

The page passes `setError` and `reportError` down, typed once as `GroupErrorReporting` in `groupErrors.ts`, so every feature still reports into the one banner under the header.

The page still starts the member info query from the URL id and the user list query, and hands both to `GroupMembership`, so they load alongside the group list rather than after it.

Moved code is unchanged apart from imports and exports, and from what follows from the features mounting only once the group has loaded: the settings draft starts from the group instead of blank defaults, and the `!community` guards go.

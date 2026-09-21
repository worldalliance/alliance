---
agent: Claude Opus 5
---

# Decisions

## One endpoint for all three role checkboxes

`PATCH /user/userdetail/:id/roles` already carried `staff` and `ambassador`
behind `AdminGuard`, so `admin` joined `UpdateUserRolesAdminDto` rather than
getting its own endpoint. `setAdmin` in `user.service.ts` was left alone; its
only caller is the `ADMIN_USER` bootstrap.

## The self-restriction lives on the server

`updateRolesAdmin` throws `BadRequestException` when `roles.admin !== undefined
&& id === actorId`, following `deleteUserAdmin`, which refuses self-deletion the
same way. The disabled checkbox is cosmetic; an admin can reach the endpoint
directly.

The guard trips on `admin` being present in the body at all, not on the value
differing from the current one. A request to set your own flag to what it
already is still expresses an intent the rule forbids.

Scoped to `admin` alone. An admin changing their own `staff` or `ambassador`
flag was already allowed and stays allowed.

On your own record the checkbox is disabled rather than hidden, since a missing
checkbox reads as a bug, and it carries `title="You cannot change your own admin
status"`. No confirmation dialog: the two sibling checkboxes toggle without one,
and revoking admin is reversible by any other admin.

## Role changes are logged in the transaction that carries the update

`EventType.AdminRoleChanged` is written through
`eventLogService.sendMessageInTransaction`, so the entry and the `UPDATE` commit
together. A grant that succeeded with no entry is the hole this closes. Same
path as `deleteUserAdmin`, the other admin action whose entry is its only
evidence. The tradeoff is that an event-log failure now fails the role change.
Slack forwarding stays outside the transaction, after the commit.

Only the `admin` flag is logged, and only when the value actually changes: an
entry saying someone "granted admin" to a person who already had it would be
false. Actor and target are recorded by id, name, and email, because names
collide and an entry that cannot identify the account is not worth keeping.
`SEND_TO_SLACK` is true for it, and `admin_role_changed` is in the admin panel's
`EVENT_TYPES` list, a hand-picked subset, so the trail can be filtered to.

## The role filter is a union, not an intersection

"Admin OR Staff" was read as a union and built as a checkbox dropdown, so Admin
alone, Staff alone, and both are all reachable. Nothing selected means no role
filter. Filters combine with AND across kinds and OR within a kind.

It mirrors the tag dropdown beside it and reuses its markup, label conventions,
per-option member counts, and Clear button. The selection is local state, not in
the query string; only `viewMode` is in the URL today.

## Not reused: the force-graph role filter

`components/force-graph/UserGraphFilters.tsx` has a `RoleFilter` enum with the
same Admin and Staff predicates. It is single-select and exclusive rather than a
union, so sharing would mean reshaping one UX to fit the other. What is
duplicated is two one-line predicates.

## Extracted to `lib/memberRoleFilter.ts`

The enum, the label/predicate `Record`, and `matchesSelectedRoles` sit in a
sibling module so the filtering rule is testable without rendering `UsersList`,
which mounts four react-query hooks. The dropdown itself stayed inline.

## Known gap, left alone

`handleStaffToggle` and `handleAmbassadorToggle` check `res.data` and silently
do nothing on a failure response, where `handleAdminToggle` uses `throwOnError`
and surfaces the message. Fixing the two older handlers was out of scope.

## Verification

- `apps/admin/src/lib/memberRoleFilter.test.ts`: empty selection, each role
  alone, the union of both, order-independence.
- `server/test/user-roles.e2e-spec.ts`: grant, revoke, self-refusal, self no-op
  refusal, a self `staff` change still succeeding, one entry per real change
  carrying the actor and target, no entry for a no-op or a staff-only change,
  and a failed entry rolling the role change back.
- Migration `1790025615174-admin-role-changed-event.ts` generated, not
  hand-edited, and run locally; `migration:generate` then finds no further
  changes. `shared/client/types.gen.ts` regenerated with `bun run gen-api`.
- Browser, against the local db: Admin gives 10 rows, Staff 8, both 10 (every
  staff member is also an admin locally), and "Reset filters" returns the
  trigger to "All roles". The checkbox is disabled with its tooltip on one's own
  record and enabled elsewhere, and a grant/revoke round trip survives a reload.
- Not checked in a browser: the `admin_role_changed` option in the event-log
  filter.

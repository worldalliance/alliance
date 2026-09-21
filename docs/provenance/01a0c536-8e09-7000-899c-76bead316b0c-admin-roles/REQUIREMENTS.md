---
user: Alex Dorey
task: Admin roles in the admin member view
---

# Requirements

- On the admin panel's member list, be able to filter members by "Admin" OR
  "Staff".
- Add a checkbox that lets an admin grant or revoke another user's admin status.
- An admin cannot change their own admin status.
- Add `EventType.AdminRoleChanged` and record admin role changes with it.

# Context established during the task

The user asked how to filter the member list by the "Member of the office"
icon. Agent finding, confirmed against the code: that icon is the `staff` flag,
and `/members` filters only by search text and tag. The agent offered to add a
role filter, and the request followed.

The user then asked which flag gates access to `admin.thealliance.org`, and
whether it is called `isAdmin`. Agent finding: the flag is the `admin` boolean
column on `User`; `isAdmin` exists only as a derived field on the sign-in
response and as a local in `communityleader.guard.ts`. Asked how to set that
flag from the web interface, the agent found there was no UI for it.
`UpdateUserRolesAdminDto` accepted only `ambassador` and `staff`, and the only
writer of `admin` was the `ADMIN_USER` bootstrap in `app.module.ts`, which is
disabled in production. The checkbox request followed from that finding.

The audit requirement came out of a review of the checkbox commit. The user
accepted the review's `no-audit-trail` finding by naming it. That finding:
granting admin is a one-click action that leaves no record of who did it, since
the `admin` column holds only the current value.

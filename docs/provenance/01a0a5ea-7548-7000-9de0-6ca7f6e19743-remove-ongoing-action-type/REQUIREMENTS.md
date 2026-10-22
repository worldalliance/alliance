---
user: Charles Lien
task: Delete the "Ongoing" action type
---

- Remove `Ongoing` as an action type. Production has no actions with this type,
  and the type will not be used in the future.
- Delete code made unused by that removal. This includes the dedicated
  `Ongoing` task UI and the `taskContents` API field and database column that it
  alone consumes.
- Remove `Ongoing` from test and preview fixtures rather than preserving an
  unused example.
- Remove the PostgreSQL enum value in a migration. If any `Ongoing` action is
  present, fail the migration instead of converting the action to `Activity`.

## Telling a staff rename from a system-assigned form slug

Agent decision. The form-slug requirements say a form keeps its slug on joining an action only if staff renamed it. No column records who set a slug, so a slug counts as system-assigned when it is the base36 no-action default or matches `^[vf]\d+$`; any other slug is a staff rename. A slug staff happened to type in that shape (`v7`) is renumbered when its form joins another action. The alternative, a stored "renamed" flag, needs a migration and a backfill that cannot know past renames either; switch to it if renumbering a typed `v`/`f` slug causes friction.

## Lock mode for slug numbering

Agent decision. `lockActionRow` takes `FOR NO KEY UPDATE` rather than `FOR UPDATE`. Its callers often already hold the action row's key share lock, and Postgres's row lock conflict table has `FOR UPDATE` conflict with key share while `FOR NO KEY UPDATE` doesn't, so the weaker mode removes the deadlock and still serializes numbering, since `FOR NO KEY UPDATE` conflicts with itself (https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

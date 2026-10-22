# Decisions

- The column is already nullable and holds real `NULL`s, so the property becomes `squareThumbnailImageAlt: string | null` rather than migrating the column to `NOT NULL`. A missing alt has a meaning: the admin form tells staff a blank alt is announced as the action name.
- One spelling of "no alt": `NULL`. The server trims the alt on write and stores a blank one as `NULL` through `trimToNull`, the repo's convention for nullable text columns, and a data migration does the same to the blank alts already stored. The response then returns the column as stored instead of collapsing blank and `NULL` into an omitted field. The write rule lands before the migration, so no blank alt can be written after the cleanup.
- The column is declared `type: "varchar"` because `string | null` erases to `Object` in decorator metadata. That is the type it already has, so the migration has no schema change.
- `CreateActionDto` takes the alt as optional, as #668 did for `timeEstimate`, so a create that leaves it out stores `NULL`.

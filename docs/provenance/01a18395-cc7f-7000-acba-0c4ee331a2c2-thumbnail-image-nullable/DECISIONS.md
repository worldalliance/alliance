# Decisions

- The column is already nullable and most actions have no thumbnail, so the property becomes `squareThumbnailImage: string | null` rather than migrating the column to `NOT NULL`. Precedent: #685 did the same for `squareThumbnailImageAlt`.
- One spelling of "no thumbnail": `NULL`. The server trims the thumbnail on write and stores a blank one as `NULL` through `trimToNull`, and a data migration does the same to the blank thumbnails already stored (local data held one). The paste-JSON import inserts without DTO validation, so it trims the thumbnail itself: an export taken before the cleanup can carry a blank. The write rule lands before the migration, so no blank can be written after the cleanup. With no blanks left, `ActionDto` renders the thumbnail whenever it is non-null and returns `null` otherwise, instead of omitting the key.
- The admin form keeps sending a cleared thumbnail as `""`; the server now stores that as `NULL`. Sending `null` instead would need `changedActionImages` and `duplicatedActionImages` reworked, because both treat `null`/`undefined` as "leave alone" (`?? undefined`, `?? stored`). That rework would change no behavior.
- The column is declared `type: "varchar"` because `string | null` erases to `Object` in decorator metadata. That is the type it already has, so the migration has no schema change.
- `CreateActionDto` takes the thumbnail as optional, as #685 did for the alt, so a create that leaves it out stores `NULL`.
- `AdminActionDto.storedSquareThumbnailImage` mirrors the column, so it becomes a required `string | null` too.

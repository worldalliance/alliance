# Decisions

- The image stays nullable: an action without a cover image is `NULL`, so the property is `image: string | null` on an explicit `varchar` column (`string | null` erases to `Object` in decorator metadata). The column already has that type, so there is no schema change.
- One spelling of "no image": `NULL`. The server trims the image on write and stores a blank one as `NULL` through `trimToNull`, as #685 did for `squareThumbnailImageAlt`, and a data migration clears the blank images already stored. A non-string image is a 400; before, the property had only `@IsOptional`.
- `ActionDto.image` and `AdminActionDto.storedImage` return `null` for an action without an image instead of omitting the key. `storedImage` restates the column, so it follows it.
- `CreateActionDto` takes the image as optional, alongside `squareThumbnailImageAlt`, so a create that leaves it out stores `NULL`.
- `echoesStoredKey` takes a `null` stored key; `actions.service.ts` passes it either column while `squareThumbnailImage` is still `string | undefined`.
- Duplicating an action without an image now sends `image: null` rather than omitting it. Both store `NULL`.
- The frontend maps a `null` image to `undefined` for `socialPreviewMeta`, so the default preview image still applies to an action without one.

# Decisions

- The label stays nullable: an action with no label is `NULL`, so the property is `customStatLabel: string | null` and the API publishes it as a required nullable string. The column is declared `type: "varchar"`, the type it already has, because `string | null` erases to `Object` in decorator metadata.
- Validation follows `squareThumbnailImageAlt`: a string, trimmed on write, with a blank one stored as `NULL` through `trimToNull`. Before, the property had only `@IsOptional`, so any value reached the database. A data migration clears the labels already stored blank. It lands after the write rule, so no blank label can be written after the cleanup.
- Create and update take the label as optional, alongside `customStatGoal`, so a create that leaves it out stores `NULL` and a patch that leaves it out keeps it.
- Admin's form sent a blank label as `""`. It now sends `null` through `actionFormInputValue`, like the thumbnail alt.
- The thumbnail alt's e2e spec now runs over both fields, since they share one rule and a change to that rule applies to both.

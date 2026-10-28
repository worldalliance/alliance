# Decisions

- The goal stays nullable: an action with no goal is `NULL`, so the property is `customStatGoal: number | null` and the API publishes it as a required nullable number. No migration; the column is already a nullable integer.
- Validation follows `timeEstimate`: an integer from 0 to the int4 maximum, `null` to clear. Before, the property had only `@IsOptional`, so any value reached the database, and a non-numeric one failed there.
- Create and update take the goal as optional, alongside `timeEstimate`, so a create that leaves it out stores `NULL` and a patch that leaves it out keeps it.
- Admin's form sent the goal as the typed text, and a blank as `""`. It now goes through `actionFormInputValue` as a number, or `null` when blank, like the other nullable number fields. That lands first so admin keeps working once the server requires a number.

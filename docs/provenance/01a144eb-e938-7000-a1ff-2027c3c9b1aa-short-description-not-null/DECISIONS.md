# Decisions

- The column becomes `NOT NULL` rather than the property becoming `string | null`. The entity, the API and every client already treat a short description as always present, and no stored action has a `NULL` one, so the type is right and the column is what lags. The migration only adds the constraint, as #541 did for a reminder group's `cohortType`.
- Before the constraint lands, the API rejects a write that would store `NULL`, so the cause is a 400 instead of a database error: the short description is validated as a string on create and update, and `UpdateActionDto` validates an explicit `null` instead of skipping it, as `UpdateCommunityDto` and the post update DTO already do. Fields that declare `@IsOptional()` still accept `null`.
- Paste JSON (`importAction`) bypasses DTO validation and stays out of scope: a pasted export carries the short description stored in the database it came from.

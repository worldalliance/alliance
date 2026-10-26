# Action and project slugs

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Column and index

`slug` is a `varchar(80)` column on `action` and `project`, declared through one `SlugColumn` decorator (`server/src/datasources/slug-column.ts`). It carries the column, a named partial unique index (`IDX_action_slug_live`, `IDX_project_slug_live`, with `where: '"deletedAt" IS NULL'`), the OpenAPI schema, and the class-validator checks. The index is named so a unique violation can be told apart from `project`'s name index. The database doesn't add a `CHECK` constraint, because the backfill output follows the same rules.

Request DTOs use `@OptionalSlugField()` together with `@ValidateIf(slugGiven)`. `PartialType`'s `@IsOptional` would let `null` through, and the column is `NOT NULL`. The `ValidateIf` sits on each field rather than inside the helper because the nestjs-typed lint rules only see decorators written on the property.

## Generation lives in a subscriber

`SlugSubscriber` (`server/src/datasources/slug.subscriber.ts`) fills a missing slug on every insert into an entity that `SlugColumn` registered. This covers the admin create endpoints, paste-JSON import, and the many e2e fixtures that insert through repositories. It's registered in both `connectionOptions()` and `testConnectionOptions()`, and it needs `@EventSubscriber()`, without which TypeORM drops it from the `subscribers` list. Raw-SQL inserts bypass it and must supply a slug.

The pure rules (`slugFromName`, `slugCandidates`) live in `server/src/utils/slug.ts`. They're in `server/` rather than `common/` because only the server generates slugs, so the frontend install doesn't gain a dependency.

## Fallback needs the id

A name that slugifies to nothing inserts with a `pending-<uuid>` placeholder, then `afterInsert` rewrites it to `<table>-<id>` in the same transaction. TypeORM ignores an id set in `beforeInsert` on a generated primary column, so the id can't be reserved up front.

## Races and 409

Generation takes a per-table `pg_advisory_xact_lock` before checking candidates. Concurrent inserts of the same name then wait for each other and get `-2`, `-3`, … rather than a 409. Without it, three concurrent same-named fixture inserts failed in `completed-action-rule.e2e-spec.ts`. The lock only serializes inserts that run inside a transaction: `save()` and the admin endpoints always do, while a bare `repository.insert()` doesn't.

An explicitly supplied slug isn't locked. The partial unique index catches a taken one, and `throwIfSlugTaken` maps a violation of that named index to a 409.

## Backfill

The migration calls a frozen copy of the rules, `server/migrations/lib/slug-backfill.ts`, rather than the app util. That follows the `migrations/lib` convention: a migration's behavior must not change after it has run. The migration adds the column as nullable, backfills it, sets it `NOT NULL`, and then creates the indexes. The local db backfilled 106 actions, all matching the format.

It runs in id order, so older rows keep the unsuffixed slug when names collide. Soft-deleted rows get a slug too, which the `NOT NULL` column needs, but they don't count toward the "taken" set, which matches the partial index. A soft-deleted row may therefore share a slug with a live one. Restoring a soft-deleted row isn't a code path today, so nothing handles that collision.

## DTOs

- `AdminActionDto` gains `slug`. `ActionDto`, the member-facing one, doesn't.
- `ProjectDto` stays `slug`-free, because the member `ActionDto` embeds it (`action.dto.ts`, `project?: ProjectDto | null`). A new `AdminProjectDto` that extends it with `slug` is what `ProjectsController` returns. That controller is already behind `AdminGuard`.
- The project create and update bodies accept optional `slug`. The action create body and the existing `PATCH actions/:id` accept it too.
- `ExportActionDto` is an `OmitType` over `Action`, so exports now include `slug`. Paste-JSON import drops the imported slug and regenerates it from the name, so importing a copy into the environment that holds the original doesn't fail with 409.

## Endpoints

`GET actions/admin/by-slug/:slug` sits beside the existing admin action reads and returns `AdminActionDto`. `GET projects/by-slug/:slug` returns `AdminProjectDto` and needs no extra guard, since the controller already has one. Both answer 404 for an unknown or soft-deleted slug.

## Admin UI

The slug renders under the action name on `ActionDashboard` as an inline edit. Clicking the text makes it an input, Enter saves, and Escape cancels. Beside it is a `lucide-react` `Copy` icon button with an `aria-label`. A 409 or validation error shows inline under the field and keeps the input open. Blurring the input cancels the edit. The slug saves through the existing `PATCH actions/:id` with only `{ slug }`. The action editor's form never carries `slug`, so saving the editor leaves the slug alone.

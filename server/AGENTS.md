## Endpoints

Before editing any `*.dto.ts` or `*.controller.ts`, read `../.claude/skills/dto-return-types/SKILL.md` — it covers constructor patterns, return-type rules, and the post-edit `bun run gen-api` step (run from the repo root with the dev server on port 3005, since `shared/client/` is consumed by frontend/admin/mobile).

Every controller endpoint needs `@ApiOkResponse({ type: })` (or `@ApiResponse`) matching its return type (omit `type` for void).

DTOs: use mapped types over entities, e.g. `SampleDto extends OmitType(SampleEntity, ['sample']) {}`.

New endpoints need `@AuthGuard`, `@AdminGuard`, or `@CommunityLeaderGuard` depending on access level.

## Entities

On an entity, `undefined` means "not loaded". A column is always loaded, so a column property is never `?` — absence is spelled `null`, and only when the column is `nullable: true`. The TS type restates the DB constraint:

```ts
@Column() name: string;                              // NOT NULL
@Column({ type: 'varchar', nullable: true })
bio: string | null;                                  // NULL
```

## Service methods

Prefer fetch-then-compute: do all DB reads up top, then run pure logic on the fetched data. Keeps the IO surface visible and the logic easy to test.

Sometimes you can't cleanly split — e.g. a later fetch depends on a value derived from earlier reads, or a fetch is conditional. Do your best; partial separation still beats fully interleaved IO and logic.

Existing methods often don't follow this. Don't refactor just to fix shape, but if you're already editing one, move it toward this structure.

## Tests

`(cd server && bun run test:e2e)` — end-to-end tests

## Migrations

**Before generating or writing a db migration, read `../.claude/skills/migrations/SKILL.md`.**

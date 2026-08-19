## Skills

Read before the matching task:

- Editing any `*.dto.ts` or `*.controller.ts` → `(root)/skills/dto-return-types/SKILL.md`
- Generating or writing a migration → `(root)/skills/migrations/SKILL.md`

## Entities

`undefined` on an entity means "not loaded". A column is always loaded, so a column property is never `?` — absence is `null`, and only where the column is `nullable: true`. The TS type restates the DB constraint:

```ts
@Column() name: string;                              // NOT NULL
@Column({ type: 'varchar', nullable: true })
bio: string | null;                                  // NULL
```

A jsonb column with real structure is declared `unknown` (or `unknown | null`) with a zod schema alongside it and the type inferred from that schema:

```ts
export const videoProcessingInfoSchema = z.object({ encoder: z.string() /* … */ });
export type VideoProcessingInfo = z.infer<typeof videoProcessingInfoSchema>;

@Column({ type: 'jsonb', nullable: true })
processingInfo: unknown | null;
```

Parse once, right after the fetch, and pass the narrowed type down — `parseAction(action): ParsedAction` in `src/actions/entities/action.entity.ts`. Homogeneous scalar collections (`string[]`, `number[]`) are fine declared directly.

## Service methods

Fetch-then-compute: DB reads up top, pure logic on the fetched data after. Keeps the IO surface visible and the logic testable. Where a later fetch depends on an earlier read, partial separation still beats interleaving. Existing methods mostly don't follow this — move one toward it when already editing it, not as its own refactor.

## Tests

End-to-end: `(cd server && bun run test:e2e)`

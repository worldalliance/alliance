## API types

For server-derived types, import from the generated client at `shared/client/types.gen.ts` instead of redefining. Regenerate with `bun run gen-api` from the repo root.

Never edit `types.gen.ts` or `sdk.gen.ts` by hand — they regenerate from server endpoints. If they're stale, write code as if the types already exist (they'll appear on regen) rather than authoring manual stand-ins.

## jsonb fields from the server

A jsonb-backed field that ships as a raw blob arrives in `types.gen.ts` as `{ [key: string]: unknown }`. Parse it with a zod schema, once at the API boundary, in `shared/parsed-dtos.ts`:

```ts
const parsedValueSchema = z.object({ value: z.string() });
export type ParsedValue = z.infer<typeof parsedValueSchema>;

export function parseValue(input: RawValueDto): ParsedValue {
  return parsedValueSchema.parse(input);
}
```

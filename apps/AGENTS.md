## Generated API client

Server-derived types come from `shared/client/types.gen.ts` — import them, don't redefine.

Never hand-edit `types.gen.ts` or `sdk.gen.ts`; `bun run gen-api` from the repo root regenerates both from the server's endpoints, with the dev server up on port 3005. When they're stale, write code against the types as they'll be after a regen rather than authoring stand-ins.

## jsonb fields from the server

A jsonb field shipped as a raw blob arrives in `types.gen.ts` as `{ [key: string]: unknown }`. Parse it with a zod schema once, at the API boundary, in `shared/parsed-dtos.ts`:

```ts
const parsedValueSchema = z.object({ value: z.string() });
export type ParsedValue = z.infer<typeof parsedValueSchema>;

export function parseValue(input: RawValueDto): ParsedValue {
  return parsedValueSchema.parse(input);
}
```

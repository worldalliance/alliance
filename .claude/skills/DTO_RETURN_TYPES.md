# Endpoint Return Types

**All controller endpoints must return a DTO class. No primitives, no unions with `null`, no `void` substitutes.**

## The rule

A controller method's return type must be exactly one DTO class (or `void` for true no-content endpoints). Anything else breaks the contract between the server and the generated OpenAPI client.

```ts
// ✅ OK
async getThing(): Promise<ThingDto> { ... }
async deleteThing(): Promise<void> { ... }

// ❌ NOT OK — raw primitive
async isEligible(): Promise<boolean> { ... }

// ❌ NOT OK — union with null
async getThing(): Promise<ThingDto | null> { ... }

// ❌ NOT OK — primitive union
async getCount(): Promise<number | null> { ... }
```

If you need to return a boolean, number, string, or any optional value, **wrap it in a DTO** with a field of that type. The DTO field can itself be `boolean`, `string | null`, optional, etc. — those restrictions only apply at the endpoint boundary.

```ts
// ✅ wrap the primitive
class IsEligibleDto {
  @ApiProperty()
  eligible: boolean;

  @ApiPropertyOptional()
  reason?: string;
}
async isEligible(): Promise<IsEligibleDto> { ... }
```

## "What if the thing doesn't exist?"

Two options, in order of preference:

**1. Throw `NotFoundException`.** This is the right answer when the absence of the resource is genuinely exceptional from the caller's perspective. The frontend handles this cleanly via `retry: false` + `response.data ?? null` in the query hook.

```ts
async getGuestFormResponse(...): Promise<FormResponseDto> {
  const response = await this.repo.findOne({ ... });
  if (!response) {
    throw new NotFoundException('Guest form response not found');
  }
  return response;
}
```

**2. Return a wrapper DTO** when absence is a normal, expected state that the caller needs to branch on without treating it as an error.

```ts
class MaybeFormResponseDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  response?: FormResponseDto;
}
async getMaybeResponse(...): Promise<MaybeFormResponseDto> { ... }
```

## Why the rule exists

NestJS serializes a `null` return value as a **200 response with an empty HTTP body** (not the JSON string `null`). The hey-api fetch client then parses the empty body as `{}`, which is truthy and passes through `value ?? fallback` checks. Callers that expected `null` get a malformed empty DTO and crash downstream.

This broke the shared action page: `getGuestFormResponse` returned `null`, the frontend got `{}`, treated it as a valid `FormResponseDto`, and handed `undefined` as `schemaSnapshot` to `FormRenderer`. See git history around the fix for details.

Primitive returns have a related class of problems: the generated OpenAPI client and the `@ApiOkResponse` decorator expect a DTO shape, so raw primitives fail swagger generation or produce inconsistent client types.

## Checklist when adding or editing an endpoint

- [ ] Return type is `Promise<SomeDto>` or `Promise<void>` — never a primitive, never a union with `null`.
- [ ] `@ApiOkResponse({ type: SomeDto })` matches the declared return type (omit `type` only for `void`).
- [ ] If the resource may be missing, pick either `throw new NotFoundException(...)` or a `MaybeXDto` wrapper — and have the frontend handle the chosen shape.
- [ ] If wrapping a primitive, the DTO has `@ApiProperty` / `@ApiPropertyOptional` on every field.
- [ ] After the change, run `bun run gen-api` at repo root so `shared/client/types.gen.ts` reflects the new signature. Do not hand-edit generated files. Then, update the callsites (if applicable).

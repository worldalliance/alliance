---
name: dto-return-types
description: NestJS endpoint return-type and DTO rules — explicit DTO return types, @ApiOkResponse matching, wrapper DTOs, constructor patterns, and the post-edit `bun run gen-api` step. Read before editing any *.dto.ts or *.controller.ts in server/.
---

# Endpoint Return Types

Controller methods must declare an **explicit** return type — a single DTO class, or `Promise<void>` for no-content endpoints. No primitives, no `T | null`, no inferred returns.

```ts
// ✅
async getThing(): Promise<ThingDto> { ... }
async deleteThing(): Promise<void> { ... }

// ❌
async isEligible(): Promise<boolean> { ... }
async getThing(): Promise<ThingDto | null> { ... }
async getCount(): Promise<number | null> { ... }
async getThing() { ... } // missing explicit return type
```

The DTO referenced in `@ApiOkResponse` (or `@ApiResponse`) **must match** the declared return type.

```ts
// ✅
@ApiOkResponse({ type: ThingDto })
async getThing(): Promise<ThingDto> { ... }

// ❌ — decorator says ThingDto, method returns OtherDto
@ApiOkResponse({ type: ThingDto })
async getThing(): Promise<OtherDto> { ... }
```

To return a primitive or optional value, **wrap it in a DTO**. The DTO's _fields_ can be optional or `| null` — the restriction only applies at the endpoint boundary.

```ts
class IsEligibleDto {
  @ApiProperty()
  eligible: boolean;

  @ApiPropertyOptional()
  reason?: string;
}
@ApiOkResponse({ type: IsEligibleDto })
async isEligible(): Promise<IsEligibleDto> { ... }
```

## Resource may not exist

**Throw `NotFoundException`** when absence is exceptional:

```ts
async getGuestFormResponse(...): Promise<FormResponseDto> {
  const response = await this.repo.findOne({ ... });
  if (!response) throw new NotFoundException('Guest form response not found');
  return response;
}
```

**Wrapper DTO** when absence is a normal state the caller branches on:

```ts
class MaybeFormResponseDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  response?: FormResponseDto;
}
```

## Why

NestJS serializes a `null` return as a **200 with empty body** (not JSON `null`). The hey-api fetch client parses the empty body as `{}`, which is truthy and passes `value ?? fallback` — callers expecting `null` get a malformed empty DTO and crash downstream.

## Update DTOs

A `PartialType(...)` update DTO has two kinds of absence, and they mean different things:

- `undefined` — field absent from the request, **leave the column unchanged**
- `null` — field explicitly cleared, **write NULL**

So a nullable column's update field is `?: T | null` — not `?: T` (unclearable) and not `: T | null` (every request must send it).

```ts
export class UpdateProfileDto extends PartialType(PickType(User, [...])) {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  cityId?: number | null;
}
```

`PartialType(PickType(Entity, [...]))` already yields that shape for a `T | null` column, so only hand-write the field when it needs its own validators or transform.

Services applying an update must branch on `!== undefined`, not truthiness:

```ts
// ✅
if (data.cityId !== undefined) {
  user.city = data.cityId === null ? null : await this.resolveCity(data.cityId);
}

// ❌ — an empty/0/false value silently means "unchanged", so it can never be cleared
if (!data.field) data.field = undefined;
```

Never route a clear through `repository.update()` as `undefined` — TypeORM skips undefined keys and the column keeps its old value. Pass `null`.

## Constructors

Response DTOs take a single `input` parameter. Assign each field manually to prevent leakage — no `Object.assign`.

```ts
// ✅
export class SuspensionPlanDto {
  @ApiProperty({ type: Date }) date: Date;
  @ApiProperty({ type: () => ProfileDto, isArray: true }) users: ProfileDto[];

  constructor(input: SuspensionPlan) {
    this.date = input.date;
    this.users = input.users.map((u) => new ProfileDto(u));
  }
}
export type SuspensionPlan = { date: Date; users: User[] };

// ❌ — Object.assign hides which fields are part of the response
constructor(input: SuspensionPlan) {
  Object.assign(this, input);
}
```

### Naming the input type

Pick the input type by this order:

1. **Entity-backed DTO** — input type is the entity itself (`constructor(input: SuspensionPlan)` above is the entity case; the named-type case below is for non-entity DTOs).
2. **Single primitive field** — take the value positionally.
3. **Otherwise** — define a named type alongside the DTO. Never use an inline anonymous type. Name it:
   - `<DtoName-without-Dto>` by default — e.g. `UploadImageResponseDto` → `UploadImageResponse`, `ConversationAdminSummaryDto` → `ConversationAdminSummary`.
   - `<DtoName>Args` (keep the `Dto` suffix, append `Args`) only when the natural name would collide with an existing type — e.g. `ConversationDto` can't use `Conversation` (the entity), so use `ConversationDtoArgs`.

   Don't reach for `Input`/`Params`/etc. — pick one of the two above.

```ts
// ✅ single primitive — positional
export class DeleteImageResponseDto {
  @ApiProperty() deleted: boolean;
  constructor(deleted: boolean) {
    this.deleted = deleted;
  }
}

// ✅ multi-field — named type
export type UploadImageResponse = { url: string; key: string };
export class UploadImageResponseDto {
  @ApiProperty() url: string;
  @ApiProperty() key: string;
  constructor(input: UploadImageResponse) {
    this.url = input.url;
    this.key = input.key;
  }
}

// ❌ inline anonymous type — name it instead
constructor(input: { url: string; key: string }) { ... }
```

**Inputs are raw data, never other DTOs.** The DTO is responsible for converting entities/raw values into its inner DTOs. Services return raw input shapes (`SuspensionPlan[]`, not `SuspensionPlanDto[]`); the controller calls `new XxxDto(...)`.

Use `PickType` over `OmitType` — explicit field lists don't silently grow when the entity gains a column, except in specific cases.

## File location

DTOs live in files ending in `.dto.ts` (e.g. `thing.dto.ts`, `action.dto.ts`) by convention.

## After editing

Run `bun run gen-api` at the repo root, then update callsites. Never hand-edit generated files.

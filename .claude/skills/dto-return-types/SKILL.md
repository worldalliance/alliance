---
name: dto-return-types
description: NestJS endpoint return-type and DTO rules — explicit DTO return types, @ApiOkResponse matching, wrapper DTOs, constructor patterns, and the post-edit `bun run gen-api` step. Read before editing any *.dto.ts or *.controller.ts in server/.
---

# Endpoint Return Types

Controller methods must declare an explicit return type — a single DTO class, or `Promise<void>` for no-content endpoints.

```ts
// ✅
async getThing(): Promise<ThingDto> { ... }
async doThing(): Promise<void> { ... }

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

To return a primitive or optional value, wrap it in a DTO. The DTO's fields may be optional or `| null`.

```ts
export type IsEligibleDtoParams = { eligible: boolean; reason?: string };

class IsEligibleDto {
  @ApiProperty()
  eligible: boolean;

  @ApiPropertyOptional()
  reason?: string;

  constructor(params: IsEligibleDtoParams) {
    this.eligible = params.eligible;
    this.reason = params.reason;
  }
}
@ApiOkResponse({ type: IsEligibleDto })
async isEligible(): Promise<IsEligibleDto> { ... }
```

## Resource may not exist

Throw `NotFoundException` when absence is exceptional:

```ts
async getGuestFormResponse(...): Promise<FormResponseDto> {
  const response = await this.repo.findOne({ ... });
  if (!response) throw new NotFoundException('Guest form response not found');
  return response;
}
```

Wrapper DTO when absence is a normal state the caller branches on:

```ts
class MaybeFormResponseDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  response?: FormResponseDto;
}
```

## Why

NestJS serializes a `null` return as a 200 with empty body (not JSON `null`). The hey-api fetch client parses the empty body as `{}`, which is truthy and passes `value ?? fallback` — callers expecting `null` get a malformed empty DTO and crash downstream.

## Update DTOs

A `PartialType(...)` update DTO has two kinds of absence, and they mean different things:

- `undefined` (or absent) – leave the column unchanged
- `null` – field explicitly cleared (write NULL)

So a nullable column's update field should be `?: T | null` — not `?: T` (unclearable) and not `: T | null` (every request must send it).

```ts
export class UpdateEntityDto extends PartialType(PickType(Entity, [...])) {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  description?: string | null;
}
```

`PartialType(PickType(Entity, [...]))` already yields that shape for a `T | null` column, so only hand-write the field when it needs its own validators or transform.

TypeORM also follows this convention in `repository.update()`: `undefined` to skip, `null` to clear.

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

Response DTO constructors take a single parameter named `input` or `params` . Assign each field manually to prevent leakage — no `Object.assign`.

```ts
// ✅
export class MyExampleDto {
  @ApiProperty({ type: Date })
  date: Date;

  @ApiProperty({ type: () => ProfileDto, isArray: true })
  profiles: ProfileDto[];

  constructor(input: MyExample) {
    this.date = input.date;
    this.profiles = input.users.map((u) => new ProfileDto(u));
  }
}
export type MyExample = { date: Date; users: User[] };

// ❌ — Object.assign hides which fields are part of the response
constructor(input: MyExample) {
  Object.assign(this, input);
}
```

### Naming the input type

Pick the input type by this order:

1. **Entity-backed DTO** — input type is the entity itself (`constructor(input: MyExample)` above is the entity case; the named-type case below is for non-entity DTOs).
2. **Single primitive field** — take the value positionally.
3. **Otherwise** — define a named type alongside the DTO. Never use an inline anonymous type. Name it:
   - `<DtoName-without-Dto>` by default — e.g. `FooDto` → `Foo`, `ExampleDto` → `Example`.
   - `<DtoName>Args` (keep the `Dto` suffix, append `Args`) only when the natural name would collide with an existing type — e.g. `BarDto` can't use `Bar` (the entity), so use `BarDtoArgs`.

   Don't reach for `Input`/`Params`/etc. — pick one of the two above.

```ts
// ✅ single primitive — positional
export class DeleteEntityResponseDto {
  @ApiProperty() deleted: boolean;
  constructor(deleted: boolean) {
    this.deleted = deleted;
  }
}

// ✅ multi-field — named type
export type UploadEntityResponse = { url: string; key: string };
export class UploadEntityResponseDto {
  @ApiProperty() url: string;
  @ApiProperty() key: string;
  constructor(input: UploadEntityResponse) {
    this.url = input.url;
    this.key = input.key;
  }
}

// ❌ inline anonymous type — name it instead
constructor(input: { url: string; key: string }) { ... }
```

**Inputs are raw data, never other DTOs.** The DTO is responsible for converting entities/raw values into its inner DTOs. Services return raw input shapes (`MyEntity[]`, not `MyEntityDto[]`); the controller calls `new XxxDto(...)`.

```ts
export class MyProfilesDto {
  @ApiProperty({ type: ProfileDto, isArray: true })
  profiles: ProfileDto[];

  // ✅ — constructor takes entities and builds the inner DTOs itself
  constructor(users: User[]) {
    this.profiles = users.map((u) => new ProfileDto(u));
  }

  // ❌ — constructor takes DTOs, so the service has to build them
  constructor(profiles: ProfileDto[]) {
    this.profiles = profiles;
  }
}
```

Use `PickType` over `OmitType` — explicit field lists don't silently grow when the entity gains a column, except in specific cases.

## File location

DTOs live in files ending in `.dto.ts` (e.g. `thing.dto.ts`, `action.dto.ts`) by convention.

## After editing

Run `bun run gen-api` at the repo root, then update callsites. Never hand-edit generated files.

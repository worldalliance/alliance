---
name: dto-return-types
description: Read before editing any *.dto.ts or *.controller.ts in server/.
---

# Endpoints and DTOs

## Return types

A controller method declares an explicit return type: one DTO class, or `Promise<void>` for no-content. Never a primitive, a union, a nullable, or an inferred type.

```ts
// ✅
async getThing(): Promise<ThingDto> { ... }
async doThing(): Promise<void> { ... }

// ❌
async isEligible(): Promise<boolean> { ... }
async getThing(): Promise<ThingDto | null> { ... }
async getThing() { ... }
```

NestJS serializes a `null` return as a 200 with an empty body, not JSON `null`. The hey-api fetch client parses that as `{}` — truthy, so it survives `value ?? fallback` and callers expecting `null` get a malformed DTO that crashes downstream.

Every endpoint also needs `@ApiOkResponse({ type })` (or `@ApiResponse`) naming that exact DTO — `type` omitted for void.

```ts
// ❌ — decorator says ThingDto, method returns OtherDto
@ApiOkResponse({ type: ThingDto })
async getThing(): Promise<OtherDto> { ... }
```

To return a primitive or optional value, wrap it in a DTO; the DTO's own fields may be optional or `| null`.

```ts
export type IsEligible = { eligible: boolean; reason?: string };

class IsEligibleDto {
  @ApiProperty() eligible: boolean;
  @ApiPropertyOptional() reason?: string;

  constructor(input: IsEligible) {
    this.eligible = input.eligible;
    this.reason = input.reason;
  }
}
```

## Guards

Every new endpoint needs `@UseGuards(X)` with a guard from `src/auth/guards/`.

## DTO classes

Build them from mapped types over the entity, preferring `PickType` — an `OmitType` DTO silently gains every new entity column. Files end `.dto.ts`.

## Resource may not exist

Absence is exceptional → throw `NotFoundException`. Absence is a normal state the caller branches on → wrapper DTO:

```ts
class MaybeFormResponseDto {
  @ApiPropertyOptional({ type: () => FormResponseDto })
  response?: FormResponseDto;
}
```

## Update DTOs

A `PartialType(...)` update DTO has two kinds of absence:

- `undefined` — field absent from the request, **leave the column unchanged**
- `null` — field explicitly cleared, **write NULL**

So a nullable column's update field is `?: T | null` — not `?: T` (unclearable), not `: T | null` (every request must send it).

```ts
export class UpdateProfileDto extends PartialType(PickType(User, [...])) {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  cityId?: number | null;
}
```

`PartialType(PickType(Entity, [...]))` already yields that shape for a `T | null` column, so hand-write the field only when it needs its own validators or transform.

Services applying an update branch on `!== undefined`, never truthiness:

```ts
// ✅
if (data.cityId !== undefined) {
  user.city = data.cityId === null ? null : await this.resolveCity(data.cityId);
}

// ❌ — an empty/0/false value silently means "unchanged", so it can never be cleared
if (!data.field) data.field = undefined;
```

TypeORM follows the same convention: `repository.update()` skips `undefined` keys, so a clear must pass `null`.

## Constructors

Response DTO constructors take one parameter, named `input` or `params`, and assign each field manually — `Object.assign` hides which fields are in the response and leaks new ones.

```ts
export type MyExample = { date: Date; users: User[] };

export class MyExampleDto {
  @ApiProperty({ type: Date }) date: Date;
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  profiles: ProfileDto[];

  constructor(input: MyExample) {
    this.date = input.date;
    this.profiles = input.users.map((u) => new ProfileDto(u));
  }
}
```

Inputs are raw data, never other DTOs — the DTO converts entities into its inner DTOs itself, so services return `MyEntity[]` and the controller calls `new XxxDto(...)`.

Naming that parameter's **type**, in order:

1. Entity-backed DTO → the entity itself (`constructor(input: User)`).
2. Single primitive field → take it positionally (`constructor(deleted: boolean)`).
3. Otherwise → a named type declared alongside the DTO, as `MyExample` is above; never an inline anonymous one. `FooDto` → `Foo`; only if that name is taken (usually by the entity), `FooDtoArgs`. Never name the type `Input` or `Params` — those are the parameter's names, not the type's.

## After editing

`bun run gen-api` from the repo root with the dev server up on port 3005, then update callsites — `shared/client/` is consumed by frontend, admin, and mobile. Never hand-edit generated files.

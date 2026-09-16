---
user: Charles Lien
task: Normalize stored emails to lowercase and match them exactly
---

# Decisions

## Normalization is trim + lowercase, not `validator.normalizeEmail`

The repo prefers a maintained package over hand-rolling, but
`validator.normalizeEmail` strips Gmail dots and `+tags`, which changes which
mailbox an address denotes. Against a database of existing accounts that
rewrites identities and merges distinct people. `trim().toLowerCase()` is the
whole of what was asked.

The trim half already existed as `@Transform(({ value }) => value?.trim())` on
the email DTO fields; `normalizeEmail` absorbs it so the two halves can't drift.

## Lowercasing the local part, not just the domain

Only the domain is case-insensitive under RFC 5321; the local part is left to
the provider. Every major provider folds it, and the existing `ILike` lookup
already assumed as much, so folding the whole address preserves current
behavior. A provider that distinguishes `Foo@` from `foo@` would now see the
two as one account.

## `common/src/email.ts`

Server-only today, but `common` is the package the mobile and web clients can
also reach, and email input normalization belongs next to `phone.ts`.

## Explicit normalization at boundaries, plus a `lower(email)` unique index

Normalization goes in three places rather than a TypeORM column transformer:
the email DTO fields, `UserService.create` (the single path every account
creation funnels through, including `createWithInviteAssignment`), and the
OAuth profile. A column transformer would also silently rewrite where-clause
values, and whether TypeORM applies it to every find operator varies by
version — a silent miss there reintroduces exactly this bug.

The backstop is a partial-free unique index on `lower(email)`, installed by the
migration and declared on the entity with `synchronize: false`, matching
`idx_city_name_trgm` in `city.entity.ts`. A write path that forgets to
normalize now fails loudly at the database instead of creating a second account
that shadows the first. The plain `unique` constraint on the column stays.

## The four lookups normalize their input

`findOneByEmail` was the only case-insensitive one; `admin.guard.ts`,
`user-already-exists.validator.ts` and `mailgun.webhook.controller.ts` matched
exactly against un-normalized input. All four now exact-match a normalized
address. The admin guard and the Mailgun webhook read their address from a JWT
and a third-party payload respectively, neither of which passes through a DTO.

## `oauth_account.email` is backfilled too

Not a lookup key — accounts are found by `provider` + `subject` — but it is a
stored address, and `authenticate` compares it to the incoming profile with
`!==`, which would otherwise write a no-op update on every case flip. No unique
constraint, so no collision risk in the backfill.

## The local database proves nothing about the collision case

613 users, zero mixed-case, zero collisions — but `sync_prod_to_staging.sh:246`
rewrites every address to `user<id>@example.com`, so staging carries no real
case distribution. The abort branch is written against prod unseen; this is the
one place the "a branch for a shape no row holds never runs" rule from the
migrations skill could not be checked.

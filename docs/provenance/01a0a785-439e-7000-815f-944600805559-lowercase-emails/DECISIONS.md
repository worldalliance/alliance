---
user: Charles Lien
task: Make emails unique regardless of case and match them exactly
---

# Decisions

## `citext` on `email`

The user asked for a robust method that's common for this type of problem and
went with the agent's recommendation. The agent weighed three: a `citext`
column, a unique index on `lower(email)`, and a generated lowercase column with
its own unique constraint (an earlier pass of this branch). It picked `citext`.

`citext` makes the column itself compare without case, so the existing unique
constraint on `email` rejects `Foo@x.com` next to `foo@x.com`, and every
`where email = $1` in the app ignores case without being rewritten. The other
two only dedupe for code that remembers to compare against the lowercase form.
The generated column also needed a hand-written `typeorm_metadata` row, and the
`lower(email)` index can't be declared on the entity, so TypeORM can't see it.

`email` keeps the address as the member typed it. Nothing is rewritten, so
`down` changes the type back without losing data.

## Case only, no trimming, not `validator.normalizeEmail`

`citext` folds case and nothing else. Sign-up, sign-in and forgot-password
already trim in their DTOs. `validator.normalizeEmail` strips Gmail dots and
`+tags`, which changes which mailbox an address denotes and would merge distinct
people. No Unicode normalization and no IDNA folding of domains.

`citext` folds with Postgres `lower`, which follows the database locale for
non-ASCII letters and can disagree with `String.prototype.toLowerCase` (`İ`).
Comparisons happen in the database, so both sides use the same rules.

## Folding the local part, not just the domain

Only the domain is case-insensitive under RFC 5321; the local part is left to
the provider. Every major provider folds it, and the old `ILike` lookup already
assumed as much. A provider that distinguishes `Foo@` from `foo@` now sees the
two as one account.

## The migration

It lists every group of accounts whose addresses differ only in case, by id and
quoted address, and throws before changing anything. The unique constraint would
fail on its own, but it names only one duplicate key.

`migration:generate` emitted `DROP COLUMN "email"` + `ADD "email" citext`, which
deletes every address. The migration uses `ALTER COLUMN ... TYPE citext`, which
rebuilds the existing unique index under the new comparison. It also runs
`CREATE EXTENSION IF NOT EXISTS citext`, which the generator leaves out. `citext`
is a trusted extension since Postgres 13, so the database owner can install it
without superuser; the production Postgres version was not checked. `down`
leaves the extension installed.

Tested locally: a seeded case collision aborts with both pairs listed and the
column unchanged; run, revert and run again keep all rows; `migration:generate`
reports no schema changes afterward. The local database is staging, where
`sync_prod_to_staging.sh` rewrites every address to `user<id>@example.com`, so
it carries no real case distribution.

## `findOneByEmail` matches with plain equality

`where: { email }`. The column is `citext`, so the match still ignores case, and
plain equality has no wildcards, so `_` and `%` in an address match only
themselves. It lands after the `citext` commit; against `varchar` it would
turn sign-in case-sensitive.

## `oauth_account.email` is left alone

Accounts are found by `provider` + `subject`, not by email, and the account's
email is compared only to the provider's own profile.

## Out of scope

`findByUsername` and `findByName` interpolate search input into `ILIKE`, so `_`
and `%` act as wildcards there too. That is search, not email lookup, and was
not asked for.

The admin guard, the Mailgun webhook, and `IsUserAlreadyExist` match `email`
with `findOneBy`, and now ignore case along with everything else. The
contract-reminder worker joins `mail."to" = "user"."email"`; Postgres compares
`citext` with `varchar` as text, so that join stays case-sensitive, as it was.

Admin time-spent stats match PostHog people to users by `email` in JavaScript,
and PostHog keeps the casing typed at the last sign-in. That mismatch predates
this branch and `email` keeps its casing, so this change doesn't make it worse.

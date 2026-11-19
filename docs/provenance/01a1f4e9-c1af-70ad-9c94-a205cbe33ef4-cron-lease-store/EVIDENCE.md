# Evidence

## `LockStore` contract and recipe

Checked 2026-11-19.

- `@nestjs/locks` 0.0.6 is still the latest version on npm; the registry entry was last modified 2026-11-06 (`npm view @nestjs/locks versions time.modified`). The tarball is ESM-only (`"type": "module"`), and declares `@nestjs/locks/testing` only in `exports`.
- The `LockStore` interface (`dist/interfaces/lock-store.interface.d.ts` in the 0.0.6 tarball; vendor documentation): the store measures ttl on its own clock; `acquire` lets exactly one of any number of concurrent callers win a free or expired key; fencing tokens grow with every acquisition of a key, across releases and expiries; `renew` and `release` are single compare-and-sets on owner; durations reach 30 days, past a 32-bit integer; keys are arbitrary strings up to 500 characters.
- NestJS, "Locks" (vendor recommendation): its Postgres recipe keeps released rows (owner cleared) so token order survives, uses `clock_timestamp()` for expiry, takes over with `INSERT ... ON CONFLICT DO UPDATE` whose `WHERE` re-checks availability, draws tokens from a sequence, and says to run `lockStoreContract` with `concurrent: true` against a real server through a pool. https://docs.nestjs.com/reliability/locks

## Runs

On 2026-11-19, on this branch, with bun 1.4.4, `@nestjs/locks` 0.0.6, `@nestjs/core` 11 and the local Postgres:

- `server/test/lease-store.e2e-spec.ts` passed all 18 cases: `LocksStorage.source` is the `PgLockStore`, the 16 contract cases with `concurrent: true` passed, and 20 rounds of two `bun` processes racing for one key each had exactly one winner, with tokens growing.
- With the `WHERE` guard removed from `acquire`'s conflict branch, 10 of the contract cases failed, the concurrency cases among them.
- `bun src/main.ts` booted and logged `LocksStorage: PgLockStore`, and `GET /` answered 200.

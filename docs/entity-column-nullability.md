# Entity column nullability — plan

Sibling of [`repository-type-soundness.md`](./repository-type-soundness.md), which
covers the _relation_ half of the entity convention. This doc covers the other
half: **non-relation fields**.

Target convention, for every field on an entity that is not a relation:

- **Never `?:` and never `| undefined`.** `undefined` on an entity means "this
  relation was not loaded". A scalar column is always loaded, so it can never be
  `undefined`, and a scalar that spells absence with `?` is indistinguishable
  from a relation that wasn't fetched.
- **`| null` iff the column is `nullable: true`.** The TS type is the DB
  constraint, restated. Nothing else.

This is only about the **read** shape — what a row looks like coming back from
Postgres. Write shape is a separate type and is the main design question below
(phase 2).

## Why this isn't cosmetic

```ts
@Column({ nullable: true })
@ApiProperty({ nullable: true })   // wire: string | null  ✓
profilePicture: string;            // server TS: string    ✗
```

233 of 485 rows in the local `user` table have `profilePicture IS NULL`. Every
server-side reader of `user.profilePicture` compiles against a type that is
wrong roughly half the time. The generated client already says
`profilePicture: string | null` — the API contract is honest and only the
server's own type lies.

The `?:` half is the same lie in the other direction. Postgres `NULL` arrives as
JS `null`, never `undefined`, so `image?: string` on `Action` describes a value
the driver cannot produce.

## Measurements

Taken 2026-08-04 against `750f03a1e` by a throwaway `@typescript-eslint/parser`
walk over `server/src/**/*.entity.ts` (`node`, not `bun` — bun can't resolve
`typescript` for the parser). Phase 0 replaces it with a lint rule, which is the
only version worth keeping.

Inventory — 59 entities, 543 non-relation fields:

| kind                          | n   |
| ----------------------------- | --- |
| `@Column`-family              | 526 |
| `@RelationId`                 | 10  |
| virtual (no column decorator) | 7   |

Violations:

| bucket                                        | n   | what                                                                  |
| --------------------------------------------- | --- | --------------------------------------------------------------------- |
| **A** `?:` / `\| undefined` on a column       | 78  | all 78 are `nullable: true` in the DB — mechanical widen to `\| null` |
| **B** TS `\| null` but column `NOT NULL`      | 0   | nothing to do                                                         |
| **C** column `nullable: true` but TS non-null | 13  | the dangerous ones                                                    |
| **D** `?:` on `@RelationId`                   | 3   |                                                                       |
| **E** `?:` on a virtual field                 | 0   |                                                                       |

**Decorators match the DB exactly.** `bun run migration:generate` reports no
changes, so `nullable: true` in a `@Column` is the schema, not an aspiration.
Every count above can be trusted as a statement about Postgres.

**Whole-repo codemod trial** (drop `?`, append `| null`, all 91 fields at once):

```
95 typecheck errors — 45 src, 49 test, 1 scripts
```

Bucket A alone accounts for 83 of them; adding bucket C costs 12 more. Top
clusters:

```
36  test/forum.e2e-spec.ts            11  src/actions/actions.service.ts
 5  test/tasks.e2e-spec.ts             4  src/tasks/tasks.service.ts
 4  test/notif-push-dispatcher.e2e     3  src/push/push.service.ts
```

Roughly half the errors are **test fixtures failing to construct an input DTO**,
not readers mishandling null. That ratio is the single most important number
here — see phase 2.

## Decisions

- **The entity type describes a read, not a write.** `CreateActionDto extends
PickType(ActionDto, [...])` inherits required-ness from the entity, so
  widening `image?: string` to `image: string | null` forces every caller to
  pass an explicit `null`. That's backwards: on input, absent and null are
  different requests ("leave it alone" vs "clear it"). 40 input DTOs derive from
  entities or output DTOs this way, 10 already wrapped in `PartialType`.

- **Adding `| null` does not break `@ApiProperty()` type inference.** Verified
  empirically — `design:type` for `string | null` is still `String`, for
  `number | null` still `Number`, for `Date | null` still `Date`. (Only a
  genuine multi-type union like `string | number` degrades to `Object`.) There
  is no swagger CLI plugin configured (`nest-cli.json` sets `builder: swc` and
  no `plugins`), so the emitted schema comes from the decorators alone.

  Consequence: **the TS change and the wire change are independent.** Widening
  an entity field to `| null` leaves the OpenAPI document byte-identical, so
  `gen-api` produces no diff and the three apps don't move. Aligning the wire is
  a separate, opt-in step (phase 7).

  Existing entities already use `@ApiProperty({ type: String, nullable: true })`
  with an explicit `type:`. That remains the safer style to write, but it is not
  load-bearing for `T | null`.

- **Bucket C splits three ways, by what's actually in the table.** Whether a
  mismatch means "widen the type" or "tighten the column" is a data question,
  not a taste question. Local NULL counts:

  | field                                     | NULL / total | verdict                         |
  | ----------------------------------------- | ------------ | ------------------------------- |
  | `user.profilePicture`                     | 233 / 485    | widen TS                        |
  | `user.profileDescription`                 | 248 / 485    | widen TS                        |
  | `user.stripeCustomerId`                   | 419 / 485    | widen TS                        |
  | `user.over18`                             | 483 / 485    | widen TS                        |
  | `city.asciiName`                          | 13 / 67049   | widen TS (13 blocks tightening) |
  | `user.referralCode`                       | 0 / 485      | tighten DB                      |
  | `action.shortDescription`                 | 0 / 86       | tighten DB                      |
  | `community.description`                   | 0 / 40       | tighten DB                      |
  | `reminder_group.cohortType`               | 0 / 253      | tighten DB                      |
  | `payment_user_data_token.paymentIntentId` | 0 / 10       | tighten DB                      |
  | `payment_user_data_token.firstName`       | 10 / 10      | widen TS **+ wire**             |
  | `payment_user_data_token.lastName`        | 10 / 10      | widen TS **+ wire**             |
  | `payment_user_data_token.email`           | 10 / 10      | widen TS **+ wire**             |

  Local counts are a hint, not proof — re-check against prod before any
  `SET NOT NULL`.

- **Columns with `default:` stay required.** `@Column({ default: false })
over18: boolean` is `NOT NULL` on read even though an insert may omit it. That
  gap belongs to the write shape, not here.

- **Bucket A is mechanical, bucket C is not.** Every bucket-A field is already
  `nullable: true`, so the codemod is a pure restatement of the schema and
  cannot change behaviour — only which call sites the compiler complains about.
  Bucket C changes what readers are forced to handle.

---

## Phase 0 — the lint rule

Mirror `relation-optionality`: the durable version of the audit script, so the
backlog is queryable and can't grow.

- [ ] `server/eslint/column-optionality.mjs`, reusing `relation-ast.mjs`
      (`findRelationDecorator` to _exclude_ relations, `propertyName`). Three
      checks: - `columnMustNotBeOptional` — a `@Column`-family or `@RelationId` property
      may not be `?:` or include `undefined`. Fixable: drop the `?`, append
      `| null` when the decorator says `nullable: true`. - `nullableColumnNeedsNull` — `nullable: true` ⇒ type includes `null`. - `nonNullableColumnHasNull` — no `nullable: true` ⇒ type excludes `null`.
      (Zero violations today; on from day one.)
- [ ] Wire into `server/eslint.config.mjs` with the first two behind options,
      defaulted off, exactly as `checkLazyOptional` is today.
- [ ] `RuleTester` tests next to `relation-optionality.spec.mjs`. The
      decorator-options reader (`nullable: true`, `default:`, enum columns) is
      the fiddly part.
- [ ] Confirm the rule reproduces 78 / 0 / 13 before trusting it.

## Phase 1 — bucket C1: `User`'s five fields

Smallest change with the highest live-lie payoff, and it proves the "wire
doesn't move" claim.

- [ ] `profilePicture`, `profileDescription`, `referralCode`, `stripeCustomerId`,
      `over18` → `T | null`. All five already carry
      `@ApiProperty({ nullable: true })`, and `shared/client/types.gen.ts`
      already says `string | null` — so this is a pure server-side correction.
- [ ] Verify `bun run gen-api` produces **no diff**. If it does, the
      `design:type` finding above is wrong and everything downstream needs
      rethinking — stop here.
- [ ] Read every new error rather than reflexively adding `?? ''` — 233 null
      profile pictures means some of these sites have a real rendering path that
      was never considered.

`referralCode` is 0/485 null and belongs in phase 3; leave its type widened for
now and let phase 3 narrow it back.

## Phase 2 — decide the write shape

Gate for phase 5. Do it after phase 1, when the failure mode is concrete.

The problem, from the trial run:

```
test/tasks.e2e-spec.ts: Type '{ name; category; body; ... }' does not satisfy
  the expected type 'CreateActionDto'. Missing: image, squareThumbnailImage,
  squareThumbnailImageAlt, donationAmount, and 9 more.
```

- [ ] Pick one: - **Wrap** — `CreateActionDto extends PartialType(PickType(ActionDto, …))`
      plus explicit re-declaration of the genuinely required fields. Cheapest;
      risks silently making a required input optional. - **Split** — input DTOs stop deriving from entities and declare their own
      fields. Most honest, most typing. - **A `WriteShape<T>` mapped type** — `{ [K in keyof T]?: T[K] }` over the
      nullable keys only, applied at the `PickType` boundary. Keeps derivation
      while making optionality a deliberate per-field statement. Note this
      moves the _TS_ type only; the OpenAPI `required` list still comes from
      `@ApiProperty` vs `@ApiPropertyOptional`, so the two must be kept in sync
      by hand.
- [ ] Whatever wins, write it down in `server/AGENTS.md` next to the existing
      DTO guidance — this is the rule that stops the convention from being
      re-broken by the next input DTO.
- [ ] Land it on `CreateActionDto` / `CreatePostDto` / `CreateCommentDto` /
      `CreatePushMessage` first: those four account for ~45 of the 49 test
      errors.

## Phase 3 — bucket C2: tighten the columns that are already non-null

One migration, `SET NOT NULL` on five columns, each 0-null locally.

- [ ] Re-run the NULL counts **against prod**, not just the local DB. This is
      the only phase that can fail at deploy time.
- [ ] `user.referralCode`, `action.shortDescription`, `community.description`,
      `reminder_group.cohortType`, `payment_user_data_token.paymentIntentId`.
- [ ] For each, confirm every write path supplies a value before constraining —
      e2e passing is decent evidence (the test DB is `synchronize`d from the
      entities, so it builds the columns `NOT NULL` too), the same argument
      phase 2 of the relations doc used.
- [ ] Drop `nullable: true` from the decorators; leave the TS types non-null.
- [ ] Read `.claude/skills/migrations/SKILL.md` first.

If any column has prod nulls, move it to phase 1's treatment instead and note
why here.

## Phase 4 — bucket C3: `payment_user_data_token`, the one wire change

`firstName`, `lastName`, `email` are 10/10 null in the table and typed
`@ApiProperty()` non-null. The client believes they're always present.

- [ ] Widen to `string | null` and flip the decorators to
      `@ApiProperty({ type: String, nullable: true })`.
- [ ] `bun run gen-api`, then `bun run typecheck` in `apps/frontend`,
      `apps/admin`, `apps/mobile`. This is the first phase that moves the
      generated client, and it's small on purpose — treat the app-side churn as
      the calibration sample for phase 7.
- [ ] Check whether these are even reachable from a client route before doing
      the work; a payment-token DTO may be server-internal.

## Phase 5 — drain bucket A (78 fields, 24 entities)

Mechanical, module by module, one commit per module. Order is smallest-first so
the convention is established before the big ones.

Codemod: drop `?`, append `| null`. Hand-check any field whose type is a
function or a bare object literal (needs parens).

| n      | entities                                                                                                                                                                                                                 | notes                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1 each | `messaging/message`, `messaging/conversation`, `community/community`, `forum/comment`, `forum/forum-digest-log`, `notifs/action-event-notif`, `notifs/unread-content`, `user/tag`, `user/friend`, `share-urls/share-url` | warm-up; ~1 error each                                                         |
| 2–3    | `user/onetime-invite`, `actions/general-update`, `forum/post`, `user/contract-event`, `user/user-device`, `user/user`, `apns/live-activity-registration`                                                                 | `forum/post` pulls in the 36 `forum.e2e-spec` errors — do it **after** phase 2 |
| 4–5    | `notifs/notification`, `tasks/formresponse`, `actions/action-activity`, `actions/follow-up-form`                                                                                                                         |                                                                                |
| 6      | `actions/reminder-group`                                                                                                                                                                                                 |                                                                                |
| 9      | `push/push`                                                                                                                                                                                                              | `CreatePushMessage` — blocked on phase 2                                       |
| 15     | `actions/action`                                                                                                                                                                                                         | 16 errors measured standalone; blocked on phase 2                              |

- [ ] After each module: `bun run typecheck`, `bun run test:e2e`, and confirm
      `gen-api` is a no-op.
- [ ] Where a new error is a real `null` that was previously ignored, fix the
      logic — don't paper it with `!` or `?? ''`. Note any behaviour changes in
      this doc as you go, the way the relations doc's "What the removal
      surfaced" section does.

## Phase 6 — bucket D: the three optional `@RelationId`s

`user/onetime-invite` ×2, `actions/action-update` ×1.

- [ ] `@RelationId` mirrors an FK column, so it follows the FK's nullability:
      `?: number` → `number | null` when the relation is `nullable: true`,
      `number` otherwise.
- [ ] Distinct from relations proper — a `@RelationId` is populated on every
      load, so it is never `undefined`. Worth a sentence in `server/AGENTS.md`
      so it isn't mistaken for relation backlog.

## Phase 7 — align the wire (optional, largest blast radius)

Independent of everything above; deliberately last.

150 `@ApiPropertyOptional` uses across entities. Wherever the column is
`nullable: true`, `?` on the wire is wrong the same way `?` in TS was: the server
serializes `"field": null`, and the client type says the key may be absent.

- [ ] Size it first with the phase 4 sample: how many app-side errors per
      converted field?
- [ ] Convert `@ApiPropertyOptional()` → `@ApiProperty({ type: X, nullable: true })`
      per module, regenerate, fix all three apps.
- [ ] Explicit `type:` is mandatory here, not just stylistic — several of these
      are enums or `Date`, where the decorator's inferred type is already doing
      real work.
- [ ] Genuinely-optional _input_ fields keep `@ApiPropertyOptional`. Phase 2's
      rule decides which is which.

## Phase 8 — ratchet

- [ ] Flip `columnMustNotBeOptional` and `nullableColumnNeedsNull` to `error`,
      delete the options.
- [ ] Fold the convention into `server/AGENTS.md` in one paragraph: entities
      describe reads; `?` means "relation not loaded"; `| null` means the column
      is nullable; input DTOs declare their own optionality.

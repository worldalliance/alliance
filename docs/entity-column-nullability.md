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
`typescript` for the parser). Phase 0 replaced it with a lint rule, which
reproduces every count below and is the only version worth keeping:

```
eslint --rule '{"local-rules/column-optionality":["error",{"checkOptional":true,"checkMissingNull":true}]}' 'src/**/*.entity.ts'
```

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

- [x] `server/eslint/column-optionality.mjs`, reusing `relation-ast.mjs`
      (`findRelationDecorator` to _exclude_ relations, `propertyName`,
      `decoratorName` — newly exported). Three checks: - `columnMustNotBeOptional` — a `@Column`-family or `@RelationId` property
      may not be `?:` or include `undefined`. Fixable: drop the `?`, append
      `| null` when the decorator says `nullable: true`. - `nullableColumnNeedsNull` — `nullable: true` ⇒ type includes `null`. - `nonNullableColumnHasNull` — no `nullable: true` ⇒ type excludes `null`.
      (Zero violations today; on from day one.)
- [x] Wire into `server/eslint.config.mjs` behind `checkOptional` and
      `checkMissingNull`, both defaulted off, as `checkLazyOptional` is today.
- [x] `RuleTester` tests in `server/eslint/column-optionality.spec.ts`. The
      decorator-options reader (`nullable: true`, `default:`, enum columns) is
      the fiddly part.
- [x] Confirm the rule reproduces 78 / 0 / 13 before trusting it.

What the rule settled while being written:

- **A property that is both optional and missing `| null` reports only
  `columnMustNotBeOptional`.** The null checks are meaningless until the `?` is
  gone, and letting both fire would give two fixers the same insertion point.
  So bucket A drains to `T | null` in one pass, and bucket C is whatever is left
  over after it.
- **`@RelationId` is reported but never auto-fixed.** Its nullability lives on
  the relation, not on the decorator, so the rule can't tell `number` from
  `number | null` — which is exactly what phase 6 does by hand. `--fix` therefore
  drains bucket A (78) and bucket C (13) and leaves bucket D's 3 reported.
- **Unreadable decorator options disable the null checks, not the rule.** A
  spread, a computed key, or a non-literal `nullable:` makes the schema
  undecidable; optionality is still decidable and still reported.
- **`@DeleteDateColumn` is treated as implicitly nullable** — TypeORM makes the
  soft-delete column nullable whatever the options say. Unused today.
- The spec is `.ts`, not `.mjs`, because `bun test` only discovers
  `.{js,ts,jsx,tsx}`. `server/tsconfig.json` now excludes `eslint/`, so the file
  runs under bun without the server's `commonjs`/node10 program trying to
  resolve `@typescript-eslint/parser` (exports-only, no `main`).

The trial `--fix` over `src/**/*.entity.ts` touched 26 files / 91 fields and was
reverted; phase 5 is where it lands for real.

## Phase 1 — bucket C1: `User`'s five fields

Smallest change with the highest live-lie payoff, and it proves the "wire
doesn't move" claim.

- [x] `profilePicture`, `profileDescription`, `referralCode`, `stripeCustomerId`,
      `over18` → `T | null`. All five already carry
      `@ApiProperty({ nullable: true })`, and `shared/client/types.gen.ts`
      already says `string | null` — so this is a pure server-side correction.
- [x] Verify `bun run gen-api` produces **no diff**. If it does, the
      `design:type` finding above is wrong and everything downstream needs
      rethinking — stop here.
- [x] Read every new error rather than reflexively adding `?? ''` — 233 null
      profile pictures means some of these sites have a real rendering path that
      was never considered.

`referralCode` is 0/485 null and belongs in phase 3; leave its type widened for
now and let phase 3 narrow it back.

### What phase 1 confirmed

**`gen-api` is a no-op.** `shared/client/` is byte-identical after regenerating
against the running server. The `design:type` finding holds: widening an entity
field to `| null` does not move the wire. Everything downstream can proceed on
that assumption. (Verified the dev server's `bun --watch` really had reloaded by
adding a throwaway `@ApiPropertyOptional` field and watching it appear in
`/openapi.yaml` within a second, then reverting — a stale server would have made
the no-diff result meaningless.)

**Four typecheck errors, and two of them were live lies.** Far below the ~12 the
bucket-C trial predicted, because the trial ran all 13 fields at once.

- `ProfileDto` — `if (user.profilePicture) { this.profilePicture = … }` left the
  property **unassigned** for the 233 null users, so the serialized object
  omitted the key entirely while the client type said `string | null`. Now
  assigns `null` explicitly.
- `UserDto` — `getImageSource(user.profilePicture)` relied on that function's
  `typeof string !== 'string'` guard, which returns `''`. So a null profile
  picture reached the client as `""`, not `null`. Now matches the sibling
  `ReferrerProfileDto`, which already had the ternary. This fixes
  `ActionActivityDetail.tsx:137`, whose `profilePicture !== null` check was
  passing on `""` and rendering an empty avatar.

  Both are wire _value_ changes (key-absent → `null`, `""` → `null`) with no
  schema change, and every frontend consumer already treats the field as
  falsy-or-string (`pfp={x ?? null}`).

- `resolveDirectPhoto` (messaging) and `search.service.userToSearchItem` feed
  fields that are genuinely `?:` on the wire, so `?? undefined` is the right
  translation, not a paper-over. Noted in passing: `resolveDirectPhoto` returns
  the raw column without `getImageSource`, unlike the `conversation.photo` branch
  three lines above — pre-existing, left alone.
- `test/auth.bearer.e2e-spec.ts` — `?? undefined` into `SignUpDto.referralCode`.
  Phase 3 makes this unnecessary.

`bun run test:e2e`: 549 pass / 0 fail. The lint rule's `nullableColumnNeedsNull`
count went 13 → 8, exactly the five fields.

### The `user` table's full NULL distribution

All 52 columns, local DB (a copy of prod), 485 rows. Only the 19 nullable
columns are listed; the other 33 are `NOT NULL` and 0-null.

| column                        | NULL / 485 | note                                              |
| ----------------------------- | ---------- | ------------------------------------------------- |
| `inviteAssignmentCommunityId` | 485        | never once set — dead column                      |
| `inviteAssignmentKind`        | 483        |                                                   |
| `over18`                      | 483        | 2 `true`, 0 `false` — see below                   |
| `referredByShareUrlId`        | 471        |                                                   |
| `customCityString`            | 452        | bucket A, still `?:`                              |
| `stripeCustomerId`            | 419        | widened in this phase                             |
| `referredByCampaignId`        | 370        |                                                   |
| `clusterId`                   | 362        |                                                   |
| `pendingCommunityId`          | 343        |                                                   |
| `referredByInviteId`          | 300        |                                                   |
| `cityId`                      | 281        |                                                   |
| `optInMmsId`                  | 275        |                                                   |
| `profileDescription`          | 248        | widened in this phase                             |
| `profilePicture`              | 233        | widened in this phase                             |
| `timeZone`                    | 181        | bucket A, still `?:`                              |
| `preferredReminderTime`       | 178        | bucket A, still `?:`                              |
| `referredById`                | 119        |                                                   |
| `welcomeMailId`               | 8          |                                                   |
| `phoneNumber`                 | 1          | already `string \| null`; 1 null blocks a tighten |
| `referralCode`                | **0**      | the phase 3 candidate                             |

Three things worth carrying forward:

- **`referralCode` is the only 0-null nullable column on `user`.** Phase 3's
  read of the table is confirmed — nothing else here is a tighten candidate.
  `phoneNumber` is the near-miss at 1 null.
- **`over18` is 483 null / 2 true / 0 false.** The column has never recorded a
  negative answer, so it isn't a boolean flag — it's "did this user ever
  affirmatively confirm 18+". `boolean | null` is the honest type and any reader
  treating it as a plain boolean is wrong for 99.6% of rows. Worth deciding
  whether the column should exist at all.
- **Empty string is a second spelling of NULL in this table**, and nobody
  intended it: `profilePicture` has 15 `''` rows on top of its 233 NULLs,
  `profileDescription` 30, `customCityString` 10.

  That third point turned up a live bug. `getImageSource('')` falls past its
  `typeof` guard and past the `startsWith('http')` check, and in production
  returns `` `https://${CLOUDFRONT_DOMAIN}/` `` — the bare CDN root, not an
  image. The old unconditional `UserDto` call therefore served 15 users a broken
  avatar URL for their _own_ profile, while `null` users got `''`. Both now
  serialize as `null`, because the new ternary is falsy-checked rather than
  null-checked. `ProfileDto` never had the broken-URL variant (its `if` guarded
  both) — it omitted the key instead.

  `profilePicture` has since been cleaned up (see below). `profileDescription`
  (30 rows) and `customCityString` (10) have the same pathology and the same
  fix, and are still outstanding.

`user`'s remaining backlog after this phase is three bucket-A fields —
`preferredReminderTime`, `timeZone`, `customCityString` — all genuinely nullable
in the data, all for phase 5.

### `| null` on a column requires an explicit `type:`

Found the hard way, and it changes the phase 5 recipe.

`bun migration:generate` runs through `typeorm-ts-node-commonjs` with
`transpileOnly: true`, so there is no type checker behind `emitDecoratorMetadata`
and a union type serializes to `Object`. TypeORM then refuses the entity:

```
DataTypeNotSupportedError: Data type "Object" in "User.profilePicture"
  is not supported by "postgres" database
```

The four phase-1 fields now carry `type: 'varchar'` / `type: 'boolean'`. Every
`| null` column that predates this plan already had an explicit `type:` — that
turns out to be load-bearing, not stylistic, and the reason nobody had hit this.

The trap is that **nothing else catches it**. The dev server (`bun --watch`) and
the e2e suite both transpile with bun, which serializes `string | null` to
`String` and works fine; typecheck passes; only `migration:generate` fails. So a
phase-5 codemod that only drops `?` and appends `| null` will produce entities
that pass CI and break the next person to touch a migration.

**Phase 5 must add an explicit `type:` alongside every `| null`**, and phase 0's
lint rule should grow a `nullableColumnNeedsExplicitType` check so this is caught
at edit time rather than at migration time.

## Phase 3 (partial) — `user.referralCode` tightened

Done ahead of the rest of phase 3, since phase 1 had already widened it and the
plan called for narrowing it back.

- [x] 0 nulls / 485 locally, and it is the _only_ 0-null nullable column on
      `user` — the full distribution above confirms nothing else here is a
      tighten candidate. (`phoneNumber` is the near miss at 1 null.)
- [x] Every write path supplies a value: `@BeforeInsert generateReferralCode()`
      sets it unconditionally, and there are no raw `insert()` calls against the
      user repo, so no path bypasses the hook. `UpdateProfileDto` cannot clear
      it. e2e passes against a `synchronize`d schema that builds the column
      `NOT NULL`.
- [x] `migrations/1785868950912-require-referral-code.ts`. The generated SQL was
      a bare `SET NOT NULL`; a backfill was added ahead of it, since one drifted
      row would otherwise fail the deploy and minting a code is exactly what the
      entity would have done.
- [x] Decorator back to `@Column()` / `@ApiProperty()`, TS back to `string`.

**This is the first phase to move the wire**, and it is a pure narrowing:
`referralCode: string | null` → `string` in `User`, `UserDto`, and
`UserAdminDetailDto`. Total app-side cost was **one line** — a `null` in
`apps/admin/src/lib/testData.ts`. As a calibration sample for phase 7 that is
encouraging, though narrowing is the easy direction; phase 7 widens.

## Phase 3.5 — blank is not a second null

`profilePicture` accepted `''` from the client and stored it, which is where the
15 blank rows came from.

- [x] `UpdateProfileDto` now declares `profilePicture` itself with
      `@Transform(trimToNull)` rather than inheriting it from the `PickType`
      list. `trimToNull` already existed in `server/src/utils/transforms.ts`,
      documented as "prefer this for nullable text columns so absence has a
      single representation" — the convention was already written down, just
      never applied here.
- [x] The DTO is the whole write surface for this column: the only other
      internal caller (`tasks.service.ts`, which builds a
      `Partial<UpdateProfileDto>`) never sets `profilePicture`.
- [x] `migrations/1785869101541-blank-profile-picture-to-null.ts` collapses the
      existing rows. Local `profilePicture` nulls went 233 → 248, blanks to 0.
- [x] Four e2e cases in `users.e2e-spec.ts`, mirroring the `phoneNumber` block
      above them. Verified they fail with the transform removed.

The wire did not move — `UpdateProfileDto.profilePicture` is still
`string | null` optional; only its position in `types.gen.ts` changed, which
confirms the re-declaration reproduces the inherited schema exactly.

Noted while in there, not fixed: `apps/frontend`'s `UserProfilePage` sends
`profilePicture: editAvatarUrl ?? undefined`, so clearing an avatar in the UI
omits the key and the server leaves the picture alone. Sending `null` is what
that path wants.

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

`user.referralCode` is done — see "Phase 3 (partial)" above. The four below
remain.

- [ ] Re-run the NULL counts against the local DB (which is a copy of prod). This is
      the only phase that can fail at deploy time.
- [ ] `action.shortDescription`, `community.description`,
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

- [ ] Delete the `checkOptional` / `checkMissingNull` options from
      `column-optionality.mjs` and from `server/eslint.config.mjs`.
- [ ] Fold the convention into `server/AGENTS.md` in one paragraph: entities
      describe reads; `?` means "relation not loaded"; `| null` means the column
      is nullable; input DTOs declare their own optionality.

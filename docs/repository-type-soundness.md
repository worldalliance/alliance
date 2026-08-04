# Repository type soundness — plan

Goal: the type system never lies about what came back from the DB. TypeORM
lies routinely, so `server/src/utils/Repository.ts` wraps it. End state:

- Every entity follows the convention — a field is optional **iff** it is a
  relation, so `undefined` unambiguously means "not loaded". Everything else is
  required and spells absence `| null`.
- Every repository is the typed `Repository<Entity>`.
- No `eager: true` anywhere.
- No find option that changes a row's shape behind the return type's back.

Status: reverted to a clean tree (`fb024e4e3`). The abandoned attempt is saved
at
`/private/tmp/claude-501/-Users-charles-github-alliance/35cb700a-83b9-411f-b516-69316984c03b/scratchpad/pre-reset-full.patch`
— worth mining for the migration (phase 2) and the two lint rules (phase 3),
not for the eager machinery.

## Decisions

- **Ban `eager: true` outright, and do it first.** The previous attempt built
  `EagerRelation`, `IsEager`, `EagerKeys`, `QueryBuilderEntity`, an
  `eager-relation-brand` lint rule and two find-option bans to model eager
  loading honestly — all of which is deleted the moment eager is gone. Build
  none of it.

  Correcting an earlier claim: that machinery is *not* needed to carry out the
  removal. The compile errors that locate the work come from the relation going
  optional (`?: Relation<X>`), which is plain convention — the `EagerRelation`
  brand contributes nothing to finding them.

- **No partial eager ban.** Keeping even one `eager: true` costs the entire
  machinery above. 7 → 1 saves nothing; 7 → 0 deletes all of it.

- **Ban shape-affecting find options rather than modelling them.** The return
  type derives a row's shape from `relations` alone, so anything that changes
  the shape independently is rejected: `loadRelationIds` (swaps relation
  objects for bare ids) and, pending a decision, `select`. Once eager is gone,
  `loadEagerRelations` and `relationLoadStrategy` are shape-neutral and need no
  ban. Future TypeORM options are then un-passable by default rather than new
  holes.

- **Rejected: make callers write `as WithRelationsExact<...>`.** A cast is
  asserted independently of the `relations` you passed, so nothing checks the
  two agree — edit the options, forget the cast, same undefined-deref with
  worse provenance. Inference from the options object is strictly more honest
  than a hand-written assertion of the same fact, and it doesn't require
  thousands of `as` casts in a repo whose `AGENTS.md` forbids them.

- **The entity type is already the honest one.** `author?: Relation<User>` is
  the union of loaded and not-loaded. That base type is safe under every knob,
  query builder and `manager.*` call. So none of `Repository.ts` is
  load-bearing for soundness — it is opt-in ergonomics, and the answer to a
  convenience that is hard to keep honest is to delete it, not cast around it.
  It also means **the escape hatch is declining to narrow**, not casting:
  `const rows: Post[] = await repo.manager.find(Post, {...})` is honest with
  zero ceremony.

## Measurements

Taken before the revert; re-verify if the code has moved.

- **Eager join cost.** `Post` has three eager `ManyToMany` joins to `User`
  (`likes`, `experts`, `authors`) plus an eager `editableContent`. The
  collections multiply rather than add:

  ```
  15 posts → 218 rows
  ```

  That fires on every `postRepository.find()`, including ones that want only
  `id` and `title`. A single post with 200 likes, 5 experts and 3 authors is
  ~3,000 rows on its own.

- **Cost of removing all 7 eager relations:** 10 compile errors in 5 files.

  ```
  6  forum.service.ts   (post.editableContent, reply.editableContent, object.likes ×4)
  1  notifs.service.ts  (comment.editableContent)
  1  post.dto.ts        1  comment.dto.ts        1  actions.service.ts
  ```

- **`Post.experts` and `Post.authors` are dereferenced nowhere** — 0 errors when
  removed. Joined on every Post read and never used; `PostDto` picks the
  `@RelationId` scalars (`expertIds`/`authorIds`) instead.

  Corrected in phase 1: `PostDto` maps both relations too, guarded by
  `? … : undefined`, which is why there were no errors. `authors` has live
  client readers; `experts` does not.

- **Entity convention backlog:** 87 required-but-lazy relations
  (`lazyMustBeOptional`). The other two checks (`missingBrand`,
  `eagerMustBeRequired`) had zero violations.

- **`select` is a live lie today:** `server/src/user/user.service.ts:1213` does
  `select: { id: true }` and returns `Promise<User[]>` — every scalar but `id`
  is absent at runtime while typed present. Predates all of this.

---

## Phase 0 — local DB drift ✅ resolved by phase 2

The reverted migration **is still applied to the local dev DB**. `migrations`
row 343 is `RequireEditableContent1785802756097`, and
`post.editableContentId`, `comment.editableContentId`, `action_update.contentId`
are all `NOT NULL` — but no migration file declares it and no entity declares
`nullable: false`.

- [x] Decide: leave it and let phase 2 re-land the migration (preferred — the
      DB is already in the target state), or unwind with
      `ALTER TABLE ... DROP NOT NULL` ×3 plus `DELETE FROM migrations WHERE id = 343`.

      Took the preferred option. The re-landed file keeps the original
      timestamp, so `migration:run` reports "No migrations are pending" locally
      — row 343 already claims it — while a fresh DB runs it in order.
- [x] Until phase 2 lands, **`migration:generate` will propose a spurious
      `DROP NOT NULL`.** Don't commit it. Gone: `migration:generate` now reports
      no changes.

## Phase 1 — kill eager ✅ done

Before any type machinery, so none of it gets built for a feature that's
leaving. Each step is a self-contained commit.

- [x] Drop `eager: true` from `Post.likes`, `Post.experts`, `Post.authors`;
      declare them `?: Relation<User>[]`. Biggest query win, 4 errors, one file
      (`forum.service.ts:859-869`). Add `relations: { likes: true }` at the
      reads that need it.
- [x] Confirm `experts`/`authors` really are unused before assuming they're
      free — the compiler can't see a raw entity serialized by
      class-transformer at a controller boundary. Check the forum endpoints'
      responses, not just the type errors.

      Result: **the doc's claim was half wrong.** `PostDto` *does* map both
      (`post.dto.ts:113-118`) — 0 compile errors only because the mapping is
      already `post.experts ? … : undefined`. `PostDto.experts` has no client
      reader (everything uses the `expertIds` scalars), but `PostDto.authors`
      is read by `ForumListPost.tsx` and `PostDetailPage.tsx`, so every
      authors-bearing read keeps `authors` loaded explicitly.
- [x] Drop `eager: true` from `Post.editableContent`,
      `Comment.editableContent`, `ActionUpdate.content`,
      `ActionActivity.editableContent`; declare them
      `?: Relation<EditableContent>`. 6 errors, 4 files.
- [x] Verify: `grep -rn "eager: true" server/src` is empty; `bun run typecheck`
      and `bun run test:e2e` green; spot-check the forum and action-activity
      endpoints in the running app for missing content.

### What the removal surfaced

- **A live bug it fixed.** `findPostsByUser` builds its query by hand and never
  joined `editableContent`, so `GET /forum/posts/user/:id` was already
  returning `editableContent: { attachments: [] }` — no `body`, no `id` — for
  every post. Eager never covered it because query builders don't apply eager.
  Now joined explicitly.
- **Nine reads were living off eager** and now request the relation by name:
  `getPostsForAdmin`, `findPostsByUser`, `findCommentsByUser`,
  `likePostOrComment` (comment branch), `notifs.service` unread-content
  hydration, `findCompletedForUser`, `getActivityForUser`, `getActivity`,
  `likeActivity` (×2), `getActionUpdates`, and the `action.updates` load at
  `actions.service.ts:943`.
- **`PostDto`/`CommentDto` now throw** when handed an entity without
  `editableContent`, rather than emitting a required API field as `undefined`.
  A missed call site fails loudly instead of rendering blank content. This is
  the small hand-rolled version of phase 6's `assertLoaded`.
- **Only two generated-client types moved** (`Comment.editableContent`,
  `ActionUpdate.content` → optional) — raw entity schemas, not the DTOs the
  apps consume. One dead frontend component (`ActionUpdatesPanel`) was typed
  against the raw entity and now uses `ActionUpdateDto`.
- **The 218-row measurement reproduces exactly** on the current dev DB:
  15 posts × the three eager `ManyToMany` joins = 218 rows on every
  `postRepository.find()`.

## Phase 2 — data integrity (independent of typing) ✅ done

- [x] Re-land `RequireEditableContent` from the saved patch: backfill, then
      `SET NOT NULL` on `post.editableContentId`, `comment.editableContentId`,
      `action_update.contentId`. Add `nullable: false` to the three relation
      decorators. (`action_activity.editableContentId` stays nullable.)
- [x] Note the relation stays `?: Relation<...>` in TS. "Always present in the
      DB" and "loaded in this query" are different claims — conflating them is
      what started all this. Nothing in phase 1's typing moved.

### Verification

- Full chain replayed on a scratch DB from empty: all 343 migrations apply,
  and the three columns land `NOT NULL` with `action_activity.editableContentId`
  still nullable.
- Backfill exercised for real: reverted on the scratch DB, seeded posts and
  comments with `NULL` content alongside rows with real content, re-ran `up`.
  The `NULL` rows each got a fresh empty `editable_content` row; the populated
  ones were untouched.
- `down` drops the three constraints cleanly (the backfilled rows stay, by
  design — they aren't distinguishable).
- `migration:generate` reports no changes, so entities and schema agree.
- The e2e DB is `synchronize`d straight from the entities, so it now builds
  those columns `NOT NULL` too — 549 tests pass against it, which is the real
  evidence that every write path supplies content.

## Phase 3 — enforce the convention with lint ✅ done

Take `relation-ast.mjs` and `relation-optionality.mjs` from the saved patch,
minus everything eager (`findEagerProperty`, `eagerMustBeRequired`, and the
whole `eager-relation-brand` rule).

- [x] Wire up the local-rules plugin in `server/eslint.config.mjs` (currently
      commented out).
- [x] Land `relation-optionality` with two checks: `missingBrand` (relation
      must be typed `Relation<...>`) and `lazyMustBeOptional` (relation must be
      declared `?:`), the latter behind a `checkLazyOptional` option.
- [x] Turn it on at `error` with `checkLazyOptional: false` — `missingBrand`
      has zero violations, so it enforces from day one and stops the backlog
      growing.
- [x] Add `RuleTester` tests. These rules are the only thing keeping the brand
      honest, and `findBrand`'s union/array/promise traversal is not obvious.

### Notes

- `findBrand` dropped its `EagerRelation` arm along with the rest of the eager
  machinery, so `Relation` is the only accepted brand.
- `missingBrand` short-circuits: an unbranded relation is reported once, not
  also as non-optional. Adding a `?` isn't the fix that matters there.
- Tests live at `server/eslint/relation-optionality.spec.mjs`. Bare `bun test`
  — what CI runs for the `server` package — does discover `.mjs` specs, despite
  the glob listed in the `test-unit.yaml` comment; verified with a deliberate
  failing canary rather than assumed.
- Backlog re-measured against the current tree: **87** `lazyMustBeOptional`
  violations, matching the pre-revert count. The seven eager relations phase 1
  removed were counted under `eagerMustBeRequired` back then, so the lazy
  number didn't move.

## Phase 4 — drain the 87

- [ ] `eslint --rule '{"local-rules/relation-optionality":"error"}' --fix` —
      the fixer inserts the `?`. Hand-fix the `foo!:` cases (the fixer skips
      them; `foo?!:` isn't valid).
- [ ] Work module by module, not in one commit. Each batch turns into a list of
      call sites that must now request the relation explicitly — that's the
      real work, and it's where behaviour changes.
- [ ] Flip `checkLazyOptional` on and delete the option once the count is zero.

## Phase 5 — land `Repository.ts`, eager-free

Most of the core already exists at `fb024e4e3`. What changes:

- [ ] `ShapeOption` = `'loadRelationIds'` (plus `select`, if banned) — `Omit`
      it from the find options. No `loadEagerRelations` or
      `relationLoadStrategy` ban needed once phase 1 is done.
- [ ] Do **not** add `EagerRelation`, `IsEager`, `EagerKeys`,
      `LazyRelationKeys`, the eager folding in `RelationRequest`/`IsLoaded`,
      `QueryBuilderEntity`, or the `createQueryBuilder` override.
      `RelationKeys` stays as it is and `createQueryBuilder` keeps returning
      `SelectQueryBuilder<Entity>`.
- [ ] Decide `select`: ban it and relocate the call sites, or model it as a
      `Pick` over the selected keys. It has real perf value and live callers,
      so unlike the other options this is a genuine trade.

## Phase 6 — migrate the repositories

- [ ] Entity by entity, swap `Repository<X>` for the typed one. `EntityShape`
      gates each: an entity that still breaks the convention resolves to a type
      naming the offending field instead of a repository, so the first call
      site tells you what's left.
- [ ] Add `assertLoaded(rows, relations)` — walks the rows and throws if a
      claimed relation is `undefined`. One property check per row per relation.
      This is the repo's own "runtime validation at trust boundaries" pattern
      applied to the boundary that actually is one: TypeORM's output. Use it
      after query builders and anywhere a call had to drop to the untyped
      repository. A wrong cast ships; a wrong checked narrow fails on row one.

## Phase 7 — lock it

- [ ] Lint rule banning `eager: true` outright — a few lines reusing
      `findRelationDecorator`, and it makes phase 1 permanent.
- [ ] Lint rule requiring the typed `Repository` over TypeORM's at
      `@InjectRepository` sites, so phase 6 can't regress.

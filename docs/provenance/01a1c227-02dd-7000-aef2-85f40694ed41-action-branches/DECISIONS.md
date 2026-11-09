# Action branches on main

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The entries below are agent-authored.

## Source

The behavior comes from dorey/scratch commit 78f4a1f04 and its provenance directory `01a16683-6c62-7000-8061-0df5dee06c59-rule-routed-action-branches`, which is not on `main`. Where that directory's requirements or decisions differ from this one, this one wins. Port its server logic, admin components and tests, adapting them to the separate table and tab, rather than re-deriving them. Its migration `1792782370994-ActionFormBranches` is not ported; this task writes its own.

## Superseded from dorey/scratch

- **Storage.** dorey/scratch stored a branch as an `ActionFormVariant` with a `rule` and `position`, made `splitValue` nullable, and enforced split-xor-rule with `CHK_action_form_variant_split_xor_rule`. Here `action_branch` holds the form, rule, position, name and copy overrides, and `action_form_variant` keeps `splitValue` required.
- **Admin.** dorey/scratch offered "Random split" or "Route by rules" on the Form Variants tab. Here each kind has its own tab (REQUIREMENTS.md, Separation from A/B variants).
- **Fakes.** dorey/scratch rewrote `.scratch/fakes` and let `scripts/import-fakes.ts` create branches. Those scripts aren't on `main`, so neither change is ported.

## Assignment record

- `action_form_assignment.branchId` references `action_branch` with `ON DELETE RESTRICT`, matching `variantId`.
- A database check allows at most one of `variantId` and `branchId`.
- `overriddenAt` and `overriddenById` are added, as on dorey/scratch.
- Readers that map an assignment to its form, today its variant's form or else `action.taskFormId`, take the branch's form too. Per-form stats, merged responses and `actionFormIds` then cover branch forms without a second table.
- Variant stats count only assignments without a `branchId`, so branch rows never land in the "Default" row.

## Services

Follows dorey/scratch's split, adapted to the new entity:

- `ActionBranchService` (`ActionVisibilityModule`, so the single-member cohort path can use it): loads an action's branches, memoized per `CohortResolutionSession`, and builds the routed cohort expression `AND(action cohort, OR(branch rules))`.
- `ActionBranchAdminService`: create, update, delete, reorder and per-branch stats.
- `ActionFormAssignmentService`: the assignment reads that were in `ActionFormVariantService`, now covering branches, plus `applyAssignedForms`, which every member-facing read uses to lay the assigned form and branch copy over the action.
- `ActionFormRoutingService`: staff moves to a variant or a branch, the routing preview, and the re-route.
- `action-arm-forms.ts`: cloning a source form and the "unlaunched and unanswered" deletion check, shared by variants and branches.

Routes live in `ActionBranchesController`: `actions/:id/branches` (list, create, `order`, `routing-preview`, `reroute`, `move`), `actions/branches/:branchId` (update, delete), `actions/:id/form-variants/move` and `actions/:id/form-assignments`. Variant CRUD routes keep their shape.

A branch's form is cloned from `sourceFormId`, which defaults to the action's `taskFormId`, as on dorey/scratch. Form slugs number branch forms with the action's other `v` forms, and a branch's form can't become another action's task form, the same as a variant's.

## Moving the decision insert out

The decision insert, which now also writes branch assignments in the same transaction, moved to `cohort-decision-insert.ts`, so `cohort-decision.service.ts` stays under its 750-line waiver. A codex read-only pass proposed splitting the service into orchestration, evaluation and storage files; only the storage part was taken, since the rest would restructure code this task doesn't change.

## Exclusivity

`ActionBranchService.create` refuses when the action has live variants, and `ActionFormVariantService.create` refuses when it has live branches. Both take the action row lock (`lockActionRow`) so two concurrent creates can't each see the other kind as absent. The tabs' locked state reads the same live lists.

## Moves on split actions

The move control for A/B variant members stays on the Form Variants tab. The Branches tab has its own members table with the move control.

## Submitting again after a move

Every staff move withdraws the member's completion (REQUIREMENTS.md, Staff moves), so for a member staff moved, only a response to their current form created after the move (`overriddenAt`) counts as submitted. Without that, a member moved away from a form they submitted and back again had no completion and was refused resubmission. Counting the old response as their completion would need the withdrawn activity restored, but `softDeleteCascade` has no restore. Multiple responses per member and form are already allowed, and response reads take the newest. `overriddenAt` comes from the server clock and `createdAt` from the database's clock, so a skew between them matters only for a submission within that skew of the move.

## Public-only

Besides branch creation refusing a public-only action, `ActionsService.update` refuses to set `publicOnly` on an action with live branches (`assertCanBePublicOnly` in `action-branches.ts`). Neither path takes a lock against the other, which leaves a race between a concurrent branch create and public-only save; it's accepted as admin-only and rare.

The guard would have taken `actions.service.ts` past its 500-line limit. A codex read-only pass proposed splitting out an `ActionQueryService` or an `ActionOrderingService`; neither was taken, since each restructures code this task doesn't otherwise touch. Instead, `evaluateCohortExpressionBatch`, a pass-through to `CohortResolverService` with one caller, moved into `ActionsController.evaluateCohortAdmin`, where the branches controller already parses cohort expressions the same way.

## Dependency analyses

`ParsedAction` carries parsed `branches` when loaded, like `followUpForms`, and `loadedActionBranches` throws when they aren't. These read the routed expression, or every branch rule, instead of `action.cohortExpression` alone:

- `decisionReadActionIds` (`server/src/actions/cohort-decision.ts`)
- `findUnawaitedOpenReferences` (`server/src/actions/cohort-reference-validation.ts`)
- reminder grouping (`server/src/notifs/reminder-group.service.ts`)

`assertNotInACohort` already blocks deleting an action named in a branch rule on dorey/scratch, and must keep doing so against `action_branch.rule`.

`CohortDecisionService` attaches branches to actions it is handed without them, so callers outside it don't have to load the relation.

## Known gaps

- Suite launch review (`apps/admin/src/components/suite-launch`) checks an action's task form and variant forms, not its branch forms. Left for a follow-up.
- In-app unread rows of the legacy action-update kind render the action's base name, not the recipient's branch name. Newer notification rows and pushes use the recipient's branch name.
- Action export and import (`ExportActionDto`) leave branches out, as they leave variants out.

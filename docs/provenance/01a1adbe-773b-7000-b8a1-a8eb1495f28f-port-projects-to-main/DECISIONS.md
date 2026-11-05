# Decisions

- "Project-related" is read as the Projects feature and what it needs. The fake-data agent skills and scripts, the member-app ↔ admin links, and the tasks-card title link stay on `dorey/scratch` (agent interpretation, not asked).
- The timeline's one-stripe-per-branch-form drawing stays behind, since branches stay behind.
- Migrations from `dorey/scratch` get new timestamps so they sort after main's latest, and each is checked by running `migration:generate` against the migrated database.
- `actions.service.ts` sat at the 500-line limit, so the action image-input helpers move to `action-image-input.ts` first. Of the splits a codex subagent proposed, this is the smallest that leaves room for this port. Splitting reads from writes is the larger option if the service grows again.
- The timeline keeps main's grouped-by-suite list under the chart and does not show slugs in its name rows. Removing the list went with the spotlight layout, and slugs in the rows were not among the approved timeline pieces.
- Admin declares `@date-fns/tz` with main's `^1.4.1` range rather than scratch's `^1.5.0`, because every web package's range has to match `apps/frontend`. The lockfile already resolves 1.5.0.
- `ActionsService.create` loads the suite through the entity manager, so it can join a caller's transaction. The soft-delete e2e test that races a suite deletion against that load now spies on the manager, not the `ActionSuite` repository.

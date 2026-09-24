---
user: Alex Dorey
task: Add a Project model
---

## User requirements

- A project is a series of actions that run week after week toward one goal (e.g. compile a list of restaurants without utensil opt-in, then ask them to adopt it). Make it a first-class model instead of a convention in suite names and cohort expressions.
- New `Project` entity in `server/src/actions/entities/` with `id`, `name`, timestamps, and one-to-many `actions`.
- `Action.project`: nullable many-to-one, declared like `Action.suite`. An action belongs to at most one project.
- Projects group actions independently of `ActionSuite`; suites stay untouched and projects must not depend on them.
- Step order within a project comes from each action's `member_action` event date; no stored position column. Two actions launching the same week are the same step.
- No fields beyond what the UI reads; no goal/description field.
- Generate the migration per the `migrations` skill.
- On the member action page (web `ActionContents.tsx`, mobile `actions/[id]/index.tsx`), render one plain-text header line above the action name with the project's name when the action has one. No link, URL, or project page. Actions without a project render as before.
- Expose the project on the action DTO the action page loads, scoped to `{ id, name }`.
- Backfill existing series with an idempotent one-off script in `server/scripts/` (precedent `backfill-image-thumbnails.ts`) run against a target database, not a migration, since the action IDs exist only in prod/staging. It fails loudly on any action ID it can't find.
- Series: Opt-in utensils 80→81; Fast fashion 141→142,143; Unclaimed property donation 70→86; Helen Keller International fundraiser 84→87; Local government public comment 53→54; E-waste 60→64; Plant-based diet study 122→123; California police AI records 91→121→135; California June primary 124→127; $1,000 allocation 47→49; Potholes 48→50; Member introductions 126→128,129; AI researcher AMA 146→153.
- Before writing the script, confirm each ID's name against the local db and report mismatches instead of guessing.

## Done when

- Migration runs up and down cleanly on the local db.
- Server e2e tests: an action with a project returns `{ id, name }` on the action-page endpoint; one without returns null.
- Web and mobile show the header on a backfilled action (e.g. 81) and nothing on one without a project (e.g. 157), verified in browser and simulator.
- Backfill run twice against the local db leaves the same rows.
- `bun run typecheck` passes in `server/`, `apps/frontend/`, `apps/mobile/`; `bun run test` passes.

## Admin project management (follow-up request)

- In the admin action overview (e.g. `/actions/80?tab=overview`), in the button row before "Open Suite", add a searchable dropdown for selecting the action's project.
- Add a pencil icon to edit an existing project's name.
- Allow creating a new project and assigning it to this action.
- Implement any other simple UX features that give barebones access to project management and assignment.

# Decisions

- **`ActionDto.project` is `?: ProjectDto | null`.** `undefined` means the relation wasn't loaded, `null` means no project. Only `findOneOrFail` (behind `GET /actions/slug/:id` and the admin slug endpoint) loads it; list endpoints that build `ActionDto` omit the field rather than paying for a join nothing reads.
- **`ProjectDto` lives in `action.dto.ts`** beside `ActionReviewerResponseDto`; it has one consumer.
- **Action import drops `project`.** `exportAction` never loads it, and a project id from another environment would point at the wrong or a missing row. Projects stay outside export/import scope until someone needs them there.
- **Backfill script follows the `backfill-image-thumbnails.ts` shape:** dry run by default, `--apply` to write. It runs in one transaction against the TypeORM CLI datasource (`src/datasources/dataSource.ts`), the same connection `migration:runprod` uses.
- **Backfill idempotency keys on project name**, since the ids a first run creates differ per database. The script aborts before writing if any action id is missing or already belongs to a project with a different name. A silent reassignment would hide a wrong id.
- **Header styling:** `text-sm text-zinc-500` on both platforms, matching the muted secondary text nearby.
- **Mobile verified via react-native-web**, following `skills/playwright/MOBILE.md`, which keeps the iOS simulator for push and deep links. The change is plain text in a shared RN component.
- **Local-db check of the series list:** every id's name matches its series. One schedule observation: Potholes 48 and 50 both open for members on 2025-11-10, 25 seconds apart, so under the "same week is the same step" rule they are one step, not 48 → 50. This doesn't change the backfill, since nothing reads step order yet.

## Admin project management

- **Endpoints live in a new `ProjectsController`/`ProjectsService`** (`/projects`, all `AdminGuard`) rather than the 3,500-line actions controller and service. Assignment is `PUT /projects/actions/:actionId` with `{ projectId: number | null }`, so all project writes share one controller. It isn't a field on `UpdateActionDto`, which the whole action form submits.
- **Project names are unique** (DB constraint, 409 on conflict, trimmed, 1–100 chars). The dropdown and the backfill both identify projects by name. The constraint is part of the single `Project` migration. The user confirmed the earlier committed version had only run on their local machine, so the two migrations were combined.
- **Step order is computed on the server** (`GET /projects/:id` → `steps`) from each action's `memberActionPhase` event. Unscheduled actions sort last, with id as the tiebreak.
- **Extra barebones features chosen:** a "No project" option to clear the assignment; a panel under the button row listing the project's steps in schedule order, each linking to its action's overview; "Delete project" behind a confirmation. Deleting unassigns the project's actions and never deletes them.
- **`ProjectDto` moved to `dto/project.dto.ts`** now that the projects controller is a second consumer.
- **The backfill script now wraps its body in `main()`**, like the thumbnail script. The server typecheck rejects top-level `await`, which the previous turn missed.
- **The name input is read-only, not disabled, while saving**, so a failed save (e.g. a duplicate name) leaves keyboard focus in the field.

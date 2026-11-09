---
user: Alex Dorey
task: Add a text ID field to each action and each project
---

## User-origin requirements

- Every action and every project has a text ID field.

## Agent-proposed, user-approved

### Purpose and name

- The text ID is a stable, human-readable reference for tooling: scripts, recorded fakes, exports. It is not a member-facing URL slug.
- The field is named `slug` on both `Action` and `Project`.

### Format and uniqueness

- A slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is at most 80 characters. Any other value is rejected with a validation error.
- Slugs are unique per table among rows that aren't soft-deleted: no two live actions share a slug, and no two live projects share a slug. An action and a project may share one. A soft-deleted row doesn't reserve its slug.

### Generation

- On create, when no slug is supplied, the server generates one from the name as kebab-case, transliterating accented and non-Latin characters with the npm `slugify` package (`Café` → `cafe`).
- A name longer than 80 characters once slugified is cut at the last hyphen that leaves the slug at most 80 characters.
- A name that slugifies to nothing (only emoji or punctuation) falls back to `action-<id>` or `project-<id>`.
- When the generated slug is taken, the server appends the next free suffix: `-2`, `-3`, … The result still fits in 80 characters.
- Renaming an action or project never changes its slug.

### Setting and editing

- The create endpoints for actions and projects accept an optional `slug`. When omitted, it is generated as above.
- Admins can change a slug after creation. The old value stops resolving; there is no history or redirect.
- An explicitly supplied slug, on create or edit, that is already taken is rejected with HTTP 409. Only generation appends suffixes.

### Existing data

- A migration backfills every existing action and project with a slug generated from its name by the rules above, then makes the column `NOT NULL`.

### Lookup and exposure

- New admin-only endpoints return a record by slug: `GET actions/admin/by-slug/:slug` and `GET projects/by-slug/:slug`. Every other endpoint keeps taking numeric ids.
- `slug` appears in admin DTOs only. Member-facing responses (web frontend, mobile) don't include it.

### Admin UI

- The action dashboard shows the action's slug under its name, inline-editable, with a copy button.
- A project's slug is set and edited through the API only. No admin UI shows it.

### Out of scope

- Changing scripts (`import-fakes`, `shift-action`, `export-action(s)`, `get-action-form`, `list-actions`) or the recorded fake YAML to use slugs.
- Referencing actions by slug in cohort expressions or prerequisites.
- Accepting or exposing slugs in member-facing APIs, URLs, or apps.
- Renaming the existing `GET actions/slug/:id`, `GET actions/adminslug/:id`, and the `slug/:id` endpoints in `tasks` and `user`, which take numeric ids despite their names.

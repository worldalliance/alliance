---
user: Alex Dorey
task: Move all the project-related features built on the dorey/scratch branch into main, asking about any that don't make sense or might not belong on main given its current state.
---

# Requirements

- Port these features from `dorey/scratch` onto a branch from current `main` (user-originated):
  - Slugs on actions and projects, with by-slug lookups and inline slug editing.
  - The admin `/projects` page and the `/projects/:id` project detail page.
  - Creating, staff-testing and scheduling an action from its project page (`/projects/:projectId/action/:actionId`).
- Port form slugs too (`v1`, `f1`…, shown as `action-slug::form-slug` in admin), since the project page's "New action" names its task form with one. Leave out the parts of that commit that belong to branch routing. (agent-proposed, user-approved)
- Leave branch routing, optional branches with "skip this action", and the branch editor header layout on `dorey/scratch`. (agent-proposed, user-approved)
- From the actions-timeline commit, port only the project coloring and project-row hover highlight, and the latest-launch sort. Leave out the type-to-search spotlight; main's ⌘K admin search covers actions. (agent-proposed, user-approved)
- Deliver as one branch with one commit per feature, opened as one PR. (agent-proposed, user-approved)

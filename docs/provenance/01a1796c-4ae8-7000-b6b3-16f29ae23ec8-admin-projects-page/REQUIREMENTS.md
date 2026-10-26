---
user: Alex Dorey
task: Admin /projects page showing projects as ordered cards
---

## User-origin requirements

- The admin panel (`apps/admin`) gets a `/projects` page that shows projects as ordered cards, covering projects in progress and projects in the works.
- Each card shows when the project started, how many of its actions are in progress, how many are planned, and how much engagement it had.
- The page carries all the per-action details the `/actions` list shows, visualized differently.
- The page is designed for a large desktop screen.
- "Projects" sits in the sidebar directly above "Actions".
- A card raises a "no update" flag when 3 weeks have passed since an action's `completed` event and the action has no update posted.

## Agent-proposed, user-approved

### Sections and order

- Cards are grouped into lifecycle sections, in this order: Live, Upcoming, In the works, Awaiting office/resolution, Done.
- A card's section is the first rule that matches its non-excluded actions:
  1. Live: any action is in `member_action`.
  2. Upcoming: any action is `planned`.
  3. In the works: any action is `draft`, or the project has no actions.
  4. Awaiting office/resolution: any action is in `office_action` or `resolution`.
  5. Done: every action is `completed`, `failed`, or `abandoned`.
- Within a section, cards with the most recent start come first.
- Every non-deleted project appears. The Done section is collapsed on every visit, and its header shows its card count.

### Which actions count

- Archived actions and onboarding actions appear in no card and no count.
- Each non-archived, non-onboarding action with no project gets its own standalone card, treated as a one-step project in the same sections.

### Card contents

- **Started**: the earliest `member_action` event date across the project's actions. A project with none shows "Not started".
- **Status counts** at the top of the card, with zero counts hidden:
  - Live: `member_action`
  - Planned: `planned`
  - Draft: `draft`
  - Wrapping up: `office_action` or `resolution`
  - Done: `completed`, `failed`, or `abandoned`
- **Mini timeline**: a small gantt strip of the project's actions. Each card's strip spans that project's own first to last event, not a scale shared across cards.
- **Step rows**: one row per action in step order, each with a status chip, dates, and completions, linking to `/actions/:id`.
- **Engagement funnel**: completions per step as raw counts, retention from each step to the next, and the project's total won't-complete and dismissed counts. No share of the targeted audience is shown.

### Attention flags

A card raises a flag when any of these holds:

- **Stuck**: an action has been in `office_action` or `resolution` for 3 weeks or more with no update posted.
- **No update**: 3 weeks have passed since an action's `completed` event and the action has no update posted. (User-origin, listed above.)
- **Deadline soon**: a member-action deadline or a next-step launch falls within the next 3 days.
- **Gap before next step**: the live or last step ends with no next step planned.

### Layout

- Cards sit in a responsive grid, with columns auto-filling at a minimum width of about 420px, so 3–4 cards fit per row on a wide screen.

### Project detail page

- Clicking a project card opens a new page, `/projects/:id`.
- That page shows the card's content at full width: a larger timeline, the full funnel, and the flags.
- It also holds project edit controls: rename, slug, categories, delete, and adding and removing actions.
- Adding an action searches every non-archived action, including ones already in another project. The picker shows an action's current project, and choosing it moves the action to this project.
- Deleting asks for confirmation: "Delete project '<name>'? Its <N> actions stay and become standalone." The confirm button reads "Delete project". After deletion, the project's actions show as standalone cards.

### Creating projects

- On `/projects`, a plus icon button opens a name input. Saving creates an empty project, which appears in In the works. Actions are added on its detail page.
- A standalone action card has a "make project" control. It opens a name input prefilled with the action's name, which the admin can edit. Saving creates the project, assigns the action to it, and opens `/projects/:id`.
- Clicking the rest of a standalone card opens `/actions/:id`.

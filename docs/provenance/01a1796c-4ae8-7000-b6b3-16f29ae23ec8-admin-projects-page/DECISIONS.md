# Admin projects page

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Data source

Both pages build cards on the client, in `apps/admin/src/lib/projectCards.ts`. The inputs are:

- `useActionsAdmin`: every action, with its project, events, status, `usersCompleted` and updates
- `useProjectsAdmin`: every project, including empty ones

`useProjectsPageData` combines the two for both pages. The detail page reads the same two queries rather than `projectsFindOneAdmin`, so a card and its detail page can't disagree.

The list DTO had no won't-complete or dismissed counts, so `AdminActionListItemDto` gains two fields:

- `usersWontComplete`: members whose latest terminal activity is a withdrawal. This reuses `sqlIsLatestWithdrawal`, so a member who withdrew and later completed isn't counted.
- `usersDismissed`: members with a dismissal and no non-deleted completion or withdrawal. A dismissal doesn't end a member's response, and a later response supersedes it.

`ActionResponseCountsService` computes both when the list is read, so no migration is needed. The DTO moved to its own file, `dto/admin-action-list-item.dto.ts`, rather than growing `action.dto.ts` and `actions.service.ts`, both well past 500 lines.

## Started date

`project.createdAt` can't serve as the start date: most projects were backfilled on 2026-09-29. "Started" uses `memberActionStart` from each action.

## Step order

Steps sort by `memberActionStart` ascending, with nulls last and action id as the tie-break. This matches `ProjectsService.findOneWithSteps`. Retention is step N's completions divided by step N−1's, in that order. Steps that open together, like Fast fashion's two steps on 2026-07-21, still each get a retention figure against the step before them.

## "All details of the /actions list"

The `/actions` timeline shows, per action: name, slug, status chip, participant (cohort) description, and phase bars. Step rows carry the same set:

- the participant segments, rendered through `ActionTimelineRowMeta` and `describeCohortExpression`
- the phase bars, as the mini timeline

## Flag interpretations

- **Stuck**: measured from the latest event that moved the action into `office_action` or `resolution`. Any update posted since that event clears the flag.
- **Deadline soon**: two flag kinds. `DeadlineSoon` fires when a Live action's `memberActionDeadline` falls within the next 72 hours. `LaunchSoon` fires when an action's `memberActionStart` falls within the same window. They're separate kinds so the copy can say "closes" or "opens".
- **Posted update**: an update counts once its `visibleAt` is set and not in the future.
- **Gap before next step**: the step with the latest `memberActionStart` is Live, and no other step has a later `memberActionStart`. Standalone cards never raise this flag, since a lone action is not expected to have a next step.

## Placement

- Sidebar entry: `{ to: "/projects", label: "Projects" }` with the `FolderKanban` lucide icon, inserted before Actions.
- Project edit controls come from the existing mutations in `useProjectsAdmin.ts`. Those mutations were bound to one action's dashboard. They now take the action id per call, as `assign({ actionId, projectId })` and `create({ name, actionId? })`. They also invalidate every `actionsFindOneAdmin` query and the all-actions list, since all of them show the action's project. `ActionProjectControls` uses the same hooks.
- `ProjectNameInput` moved out of `ActionProjectControls.tsx` into its own file. It's the inline name input everywhere: new project, make project, rename, and also the slug editor.
- The participant segments for step rows come from `useActionParticipants`, extracted from `Actions.tsx` so both pages describe cohorts the same way.
- Deleting relies on the existing `ProjectsService.remove`, which already unassigns the project's actions.

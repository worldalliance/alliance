## Target

The orchestrating agent assigned the `HomePage.tsx` waiver so that agents running the same workflow in parallel take non-overlapping files (REQUIREMENTS.md).

## Fix

The waiver defers splitting a page over the 500-line `alliance/max-lines` limit, so the fix is the split, with no behavior change.

- `apps/frontend/src/components/HomeGeneralUpdates.tsx` renders the updates row, the general updates load failure, and the sorted general update cards. The page rendered this block twice, once per screen size, and now renders the component in both places.
- `apps/frontend/src/lib/useSidebarProgressBarEntries.ts` fetches the aggregate views for the member's open task forms and derives the sorted progress bar entries. `apps/frontend/src/components/SidebarProgressBars.tsx` renders those entries as links to their actions. The hook stays on the page, not inside the component, because the page renders the bars in the sidebar on a large screen and in the main column otherwise; a hook inside the component would refetch whenever the screen crosses that width.
- `apps/frontend/src/pages/app/TaskNavigatorList.tsx` renders the task list: the current-week summary, completed tasks with their follow-up forms, and the current-week and upcoming tasks. This takes the page from 468 non-blank lines, just under the limit, to well under it. The navigator queue and its selection stay on the page, because the page renders its main column under a different parent on each side of the large-screen width, which remounts it; selection state inside the list would reset to the first task on that switch. The list's three row callbacks shared the same find-and-select step, which is now one `selectWhere`.

## Tests

`HomePage.test.tsx` had no coverage of the progress bars or of picking a task or follow-up form from the list. It now covers a progress bar linking to its task, and the main column opening the task or follow-up form the member picks. The tests land before the task list moves out of the page, so they pass against the page both before and after that move.

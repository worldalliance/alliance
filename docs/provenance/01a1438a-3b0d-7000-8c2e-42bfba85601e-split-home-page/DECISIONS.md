## Target

The orchestrating agent assigned the `HomePage.tsx` waiver so that agents running the same workflow in parallel take non-overlapping files (REQUIREMENTS.md).

## Fix

The waiver defers splitting a page over the 500-line `alliance/max-lines` limit, so the fix is the split, with no behavior change.

- `apps/frontend/src/components/HomeGeneralUpdates.tsx` renders the updates row, the general updates load failure, and the sorted general update cards. The page rendered this block twice, once per screen size, and now renders the component in both places.
- `apps/frontend/src/lib/useSidebarProgressBarEntries.ts` fetches the aggregate views for the member's open task forms and derives the sorted progress bar entries. `apps/frontend/src/components/SidebarProgressBars.tsx` renders those entries as links to their actions. The hook stays on the page, not inside the component, because the page renders the bars in the sidebar on a large screen and in the main column otherwise; a hook inside the component would refetch whenever the screen crosses that width.

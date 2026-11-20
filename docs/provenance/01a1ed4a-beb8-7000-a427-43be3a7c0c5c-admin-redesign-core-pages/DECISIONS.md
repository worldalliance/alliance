# Decisions

All entries are agent decisions (agent judgement) unless marked otherwise. The page-by-page brief for this PR came from the agent running the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell` (requirement 8 there: later phase 1 PRs are carried out by subagents). Its points are agent proposals, not owner requirements; the ones below marked "from the brief" are carried out as given.

## Primitives

Shared by these pages and meant for the Members page in PR 4 (from the brief: general enough for a filterable table page, no more).

- `Section` (`components/ui/Section.tsx`): `title`, `meta` (beside the title, such as a count), `description`, `actions` (right side of the header), `collapsible: { defaultOpen }`, `className`, body. A white surface with a `zinc-200` border and no shadow; the heading is an `h2` under `PageShell`'s `h1`, and the section is a landmark named by it.
- `StatTile` (`components/ui/StatTile.tsx`): `label`, `value`, `hint`. A `null` or `undefined` value shows "—" with "No data" for screen readers, never 0, per `ux-guidelines` (absent values).
- `FilterBar` (`components/ui/FilterBar.tsx`): `search { label, value, onChange }` and `filters`, each either `Options` (a checkbox list; all checked filters nothing) or `Toggle` (filters when checked). Active filters show as chips with a remove button. The bar is controlled: the page owns definitions and values, and keeps them in the URL through `lib/useSearchParam.ts`. The search box keeps its own text while the values it sent come back in order, and takes any other value, such as one Back restored, even while focused: URL updates render in a transition, so a box bound straight to the URL dropped keystrokes typed before the last one landed. Removing a chip moves focus to the next chip, or the Filters button after the last. A chip shows unless every option is selected, so a stray value in the selection can't hide a narrowing. Two filter kinds cover the Actions page and the Members page's likely status and boolean filters; ranges and dates wait for a page that needs them.
- `SegmentedControl` (`components/ui/SegmentedControl.tsx`): a labelled radio group. Not in the brief, but the Actions view toggle needs one and the completion-curve chart's Daily/Hourly switch is a second caller, so both now share it. Native radios give arrow-key movement and the checked state for free.
- `controlStyles.ts`: primary (`zinc-900`), secondary and input class strings, so buttons and fields across these pages look the same. Not tokens: requirement 6's palette is Tailwind's, as PR 1 recorded.

URL updates replace the history entry rather than push, as the Actions page did before #1028, so typing in search doesn't fill Back with one entry per keystroke. URL updates render in a transition, so a second update before the first renders would build on the old params and undo the first, such as typing then quickly toggling a filter. `useSearchParam` remembers the last update and the location it was made on until that location changes, and builds the next update on the same location on it; an update left behind by navigating away never reaches another page. When the leave guard refuses a navigation, the remembered update goes back to the one whose navigation is still in flight, or to none, since only that one will land. The maintained package nuqs also batches same-tick updates, but its react-router adapter writes the URL with `history.replaceState` before (or, by default, instead of) navigating, so the leave guard's blocker can't refuse its updates (read in nuqs 2.10.3's `dist/react-router-*.js`, 2026-11-25); the hook stays hand-rolled.

## Projects

- The page is full width (`PageWidth.Full`), so 3–4 cards still fit per row on a wide screen, as `01a1796c-4ae8-7000-b6b3-16f29ae23ec8-admin-projects-page` requires.
- "New project" is a labelled primary button (from the brief).
- Phase groups are Sections with counts; Done stays collapsed by default, as before.
- Cards show the name, category icons, status pills (step counts and "Standalone action"), one summary line ("Started … · N completions · N won't · N dismissed", the totals that used to sit in a footer) and the step list (from the brief). The thin mini-timeline moved off the cards and stays on the project page (requirement 5), since the brief's card contents leave it out and it was the busiest part of each card.
- Warnings are one amber line with an icon (from the brief). With exactly one warning the line is the warning itself; a "1 warning" toggle would hide the only thing it says behind a click. With two or more it reads "N warnings" and expands to the list. The project page, which has room for them, starts with the list open.
- The standalone card's icon-only "Make a project from this action" button now reads "Make project", per `ux-guidelines` (icons stand alone only for close, search, send, delete and settings).

## Project page

- `PageShell` with the back link to Projects, the step-count pills as `meta` and the summary line as `description`.
- "Delete project" is a destructive `menu` item and opens the same confirmation dialog (from the brief).
- The step list is a Section titled "Actions" with "Add existing action" and "New action" in its header (from the brief).
- The unlabelled controls beside the title (pencil buttons for name and slug, icon-only category toggles) move into a "Details" Section below the steps: "Edit project name", "Edit project slug", and the category picker with each category's name beside its icon and a check mark on selected ones, so selection isn't shown by colour alone. The picker's labelled form is a `showLabels` option, leaving the compact form in the action form and the action workspace (PR 2's) unchanged.

## Actions

- One view at a time, List (default) or Timeline, chosen with a labelled segmented control and kept in the URL as `?view=timeline`; List leaves the param out (from the brief). This supersedes the two stacked scroll boxes, a height-limited timeline above the list, of `01a0c684-f671-7000-b54a-68e4c06f58fc-actions-page-scroll-boxes`: each view now has the page to itself, and the timeline keeps its most-recent-first order.
- The suite grid is gone. "Group by suite" is a list option kept as `?group=suite` (from the brief). Grouped, each suite is a Section with an "Open suite" link; the order is the old one, suites with only archived actions last (`lib/groupActionsBySuite.ts`).
- The in-progress suites panel (requirement 7, `lib/inProgressSuites.ts`) is a `Section` that starts open, above the filter bar rather than between it and the list, because the filters don't apply to it. Each action shows its Draft or Active bucket as a `StatusPill`, Active in the live tone like the Member action status. It is hidden when no suite has a draft or active action, and leaves out archived and onboarding actions as before.
- Status and archived filters live in `FilterBar` (from the brief), with their existing URL params (`status`, `archived=1`). The archived toggle reads "Include archived" so its chip makes sense alone. The default status filter (Active, Pending, Draft) shows as a chip, so it is visible that the list is filtered; removing it shows every status.
- Kept from #1028, which landed on main while this was in review: a polite status region, mounted from the first render, announces "Every action is archived." and "No actions match these filters." while focus stays in the filters, and "Show archived actions" moves focus to the Include archived chip, since the button disappears. The empty timeline's header nesting from #1028 is dropped, since the timeline no longer holds the filters. #1028 also made each status and archived change push a history entry; these filters replace it, as every `useSearchParam` update does (see above). That reverses #1028's choice and is for the owner to confirm.
- Behaviour change: the filters now apply to the list as well as the timeline. Before, the status filter narrowed only the timeline while the grouped list below showed every unarchived action. With one view at a time, a filter that silently didn't apply to the view on screen would mislead.
- The search box (part of `FilterBar`, from the brief) matches action names and is kept as `?q=`. It is the one small addition on this page.
- "Create" is the primary button in the page header (from the brief). With the status filter in `FilterBar`, this supersedes the "Actions calendar" section of `01a0d01b-2adf-7000-88f2-29de64dd3166-admin-actions-filter-and-sidebar-folders`, which put the status dropdown and a green "+" Create icon in the timeline's top-left "Actions" cell: the page header and filter bar are where every redesigned page keeps them, and they apply to the list too.

## `/timeline` redirects to the Timeline view

`/timeline` rendered `NewActionTimeline`, an unfinished prototype from 2025-10 ("work on custom admin timeline") that drew a zoomable date axis and a "now" line with no actions on it. It covers the same purpose as the Timeline view and shows nothing that view lacks, so it counts as a duplicate: `/timeline` now redirects to `/actions?view=timeline` and the prototype is deleted. Its wheel-zoom idea is the only thing lost; it can return as a feature of the Timeline view if wanted. The sidebar has no Timeline entry: the Actions page's View switch reaches the timeline, and a link to `/actions?view=timeline` could never be marked current, since the sidebar matches paths without their query.

## Stats

- `PageShell` titled "Stats", full width so charts span the content area (from the brief).
- Headline numbers are four `StatTile`s: total members, completion reliability, all-time churn, last month churn. Missing figures show "—" where they used to show "[No data]%", or "0%" for all-time churn with nobody ever signed.
- Member time is its own Section with the hourly rate input in its header and two tiles in the body.
- Every report is a Section with its parameters (weeks, date ranges, quick ranges, Recalculate, Refresh) in the header (from the brief). `TimeSeriesChart`, used only by Stats, renders its frame through `Section`, so its charts follow without each one changing.
- Reports render on load with their defaults (from the brief; requirement 6). Missed actions, member reliability (5 weeks) and the tenure cohort (4 weeks) used to wait for a green "View …" button. Trade-off: opening Stats now sends those three requests every time. None of the three refetches on window focus or reconnect, as missed actions already didn't, so returning to the tab doesn't send them again. Missed actions keeps a "Refresh" button; the weeks reports keep an "Apply" button for new parameters. `useAppliedQuery` takes the initial value, and `useMissedActionsAdmin` loses its `enabled` option, which nothing sets now.
- The daily-stats range controls used to float between two charts and drive a table collapsed at the bottom of the page. They now head a "Daily stats" Section whose table shows inline, scrolling past 24 rem. The per-action table is likewise an inline "Action stats" Section.
- The date-range pair, hand-written five times with labels not tied to their inputs, is one `DateRangeInputs` component whose labels wrap their inputs.
- Values stay available as text: the bar charts and funnel already print their values, and the daily and per-action tables give the time series' figures. The line charts (members over time, completion rates, completion curves, cohort reliability) still show exact values only on hover; adding text alternatives for them is new work rather than layout, so it is listed as an open question for the owner rather than done here.
- Chart titles are sentence case, per the root `AGENTS.md` **Capitalisation** rule.
- Order is unchanged apart from Daily stats, which sits where its controls used to be.

## Colour

Green is kept only where it is status (the "Member action" pill, completion bars and rates). The green primary and "View" buttons become zinc. Links on these pages are `blue-600`. Existing status pills keep their colours, as instructed.

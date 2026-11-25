# Admin design guide

Read this before redesigning a place in `apps/admin`. Many agents build pages at once, each alone; this guide is what makes the pages one product. A good result: a staff member moving from your page to any other finds the same header, the same table, the same way to save, confirm and go back, and can still do everything they could on the old page.

It holds what you can't get from reading the components: which template a place uses, the rules that span pages, and the constraints of this redesign. Components are in `apps/admin/src/ui`, page templates in `apps/admin/src/ui/templates`, tokens in the second `@theme` block of `apps/admin/src/index.css`; this guide names each and you read its props in the file.

The spec is `docs/provenance/01a2113f-1284-77d9-a6e3-9a2aec087109-modern-admin-redesign/` ("the spec" below). `agents/skills/ux-guidelines/SKILL.md` applies in full and this guide doesn't repeat it; where this guide departs from the skill on purpose it says so, as for one-off values, and the guide wins; on any other disagreement, tell the system owner (see **Who owns what**) and follow the skill meanwhile.

## Before you start

In a fresh worktree the server won't boot and typecheck fails until both of these have run: `bun run migration:run` in `server/` (against your worktree's database), and `bunx react-router typegen` in `apps/admin`. Then start the apps from the repo root with `bun run server:dev` and `bun run admin:dev`, which use your worktree's ports (`.worktree/AGENTS.md`).

Reference page: Members › Groups, in `apps/admin/src/pages/groups/` (`/members/groups`, `/members/groups/:id`). Read it beside this guide and copy its shape:

- `GroupsPage.tsx`: a List place with tabs. One `Page`; the queries both tabs need; a queue count on a tab; per tab, a `Banner` for a part that failed to load and a `RefreshFailedBanner`; a list-wide number in the description; the header's create button Default on the tab that has its own primary.
- `AllGroupsTab.tsx`: `useListSearch`, `listCount`, `ContentState` for loading, failed, no results and nothing yet, then `<Table bleed>` with `TableCell truncate`.
- `AwaitingTab.tsx`: a control in each row, one list-wide primary in the filter bar, a refusal as `InlineError` there, and a `ConfirmDialog` that stays open, `busy`, while the write runs.
- `NewGroupDialog.tsx`: create in a dialog, then open the new record. `AddPersonDialog.tsx`: a refusal in `ModalFooter`'s `error`, and nowhere else.
- `GroupPage.tsx`: a Record with tabs: title from the record, facts in the description, a skeleton per tab, failed, not found (a non-numeric id included), a danger action behind `confirm`, a failed write as a dismissible `Banner`.
- `GroupMembersTab.tsx`: a table in a `Panel` with `PersonCell`, `TableCell actions`, row actions behind `confirm` that say what the server does, `busy` while each runs, and focus moved after a row removes itself. `GroupSettingsTab.tsx`: an explicit-save form with `SaveBar` and `useLeaveGuard`. `GroupProgressTab.tsx`: a legacy component mounted as is.
- `groupRules.ts`, `useGroupAssignment.ts`, `useGroupMembership.ts`: the page's rules and state, out of the markup. The `*.test.tsx` files show what a page test wraps the page in.

When this guide and the reference page disagree, the guide is right and the page has a bug to report.

## What you must keep

These bind every page. Each has a reason a reviewer will check against.

1. **Nothing staff can do today is lost.** The spec's `inventory/{tasks,forms,members,growth}.md` list every capability of every route with an ID (`PR-3`, `AD-41`, or a numbered item under a route heading; cite an entry with neither by its heading and bullet). Before you design, read the entries for every route `PLACES.md` maps to your place. Your report lists each as carried, moved (where to) or dropped (why, and who approved). A capability with no entry in your report counts as lost.
2. **Content is today's, look is the prototype's.** A screen shows what today's page shows. The prototype (the spec's `README.md` says where it is) is a reference for look, not a spec, and its data is invented: `DATACHECK.md` lists what the server can't provide and the substitute or "drop" for each. Never render a number, column, status or chart the server doesn't give you, and never fill a gap with a placeholder value. Where the reference prototype is silent, lean to prototype C's look (calm surfaces, generous spacing), except C's home page.
3. **Reuse the data layer, write the presentation new.** Keep the page's data hooks, mutations, validation, rules in `lib/` and their tests. Write the markup new from the inventory entry and the templates: restyling the old JSX class by class is not a redesign, and it carries the old layout's defects along. Rewriting logic is how a feature gets dropped without anyone noticing. You may give a hook `enabled` or a page-local wrapper so it doesn't fire on an id that can't exist.
4. **No server change, and no change outside `apps/admin`.** Where a fix needs the server, leave today's behaviour and report it for a Linear issue in the "Modern admin" project.
5. **Guards on member-facing operations stay or get stronger.** Most of them exist only in the admin UI, so a screen you drop takes its guard with it and the server won't catch it. See **Operations that reach members**.
6. **Components come from `apps/admin/src/ui` only.** Never import `@alliance/sharedweb/ui/*` in the admin (lint). The shared form renderer, API client and hooks are still imported from where they live. Merge classes with `cn` from `ui/cn.ts` (lint). Buttons take `variant={ButtonVariant.X}` (lint).
7. **Tokens only.** No raw colour classes, hex or `oklch()` values, and no arbitrary values such as `p-[13px]`, in classes or in `style`, `fill` or `stroke` (lint, which reads only literals: a numeric length in `style`, which React renders as px, or a colour inside a condition is the reviewer's to catch; a length computed from data, such as a bar's `${share}%`, is fine). The ux-guidelines allowance for one-off values doesn't apply in the admin: ask for a token.
8. **Fix today's defects in your area** where no server change is needed; the list is in the spec's `DECISIONS.md` under "Data and defects".
9. **Nothing in view moves** (admin-wide: the agents' extension of the owner's requirement that selecting in the form builder doesn't make the page jump; the owner was told and did not object). Selecting, hovering, opening an inspector, sheet or menu, a load finishing, a save bar or bulk bar appearing: none shifts content the reader is looking at. The templates hold this: skeletons are laid out at once and take the content's shape, the save bar is one height always, the bulk bar floats, `Page`'s `bannerPending` holds a banner's line. Don't undo it: no control that appears only on hover or selection in the flow, no border that adds width when selected, no panel that mounts beside content and squeezes it. The rule names no exceptions; the agents accepted these moves, and only these: a failure or refresh banner appearing, a field's error line, results landing in a panel the reader asked to load, a row expanding in place, Home's queue list landing, an unsized table's columns settling when its rows land, content whose height comes from its data (a bar per task, a row per cohort) landing below the first screen, the form builder's outline rows and accordion section expanding to reveal a new selection (in a single-open accordion, closing the section that was open), and the held banner line closing on a record that turns out to have no banner.
10. **Member content keeps the member look.** Any container of `FormRenderer`, `DisplayOnlyBlocks`, `RenderDisplayBlock`, `OutputRenderer`, `AppMarkdownWrapper` or `ActionUpdateCard` gets the class `member-surface`, which restores the member app's type inside the admin's.
11. **Read the endpoint before you describe it.** Before writing a time, what a count counts, a consequence ("can't be undone", "members see…", "they are notified") or what a save stores, read the server handler and the hook, and for anything members see, the endpoint the member app reads it through, and say only what they do. Three of five trial pages got this wrong: a 6-hour sample shown as the minute a job runs, a save note that was false after a cleared date, a removal that didn't say it notifies the member. Your report cites the server file for each such sentence. A value that depends on a part still loading or failed is "—".

### Files

A place's files live in one folder, `apps/admin/src/pages/<place>/`, named for the place's path (`pages/groups/`), with its record's page beside it. A stranger finds a page from its URL, and deleting the folder deletes the place.

| File                                          | Holds                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `<Place>Page.tsx` (`GroupsPage.tsx`)          | The place's route: the default export `routes.ts` points at. One `Page`, its tabs, the queries more than one tab needs.  |
| `<Record>Page.tsx` (`GroupPage.tsx`)          | The record's route, the same way.                                                                                        |
| `<Name>Tab.tsx`                               | One tab's body, a named export. A page without tabs has its body in the page file.                                       |
| `<Verb><Thing>Dialog.tsx`, `<Thing>Sheet.tsx` | One dialog or sheet. A plain `confirm()` needs no file.                                                                  |
| `<thing>Rules.ts`, `use<Thing>.ts`            | Rules and state the markup reads, so they can be tested and read without it.                                             |
| `<File>.test.tsx`                             | Beside the file it tests. An old page's test moves here with `git mv` and is edited, not rewritten, where it still fits. |

When every file of an old page is replaced, delete the old files (`pages/<Old>Page.tsx` and the files under `src/components/` only it used) in the same commit, unless another place still imports one. A place merged from several pages (its route today is a module in `src/places/`) moves to `pages/<place>/<Place>Page.tsx` too; delete the `places/` module and repoint its `routes.ts` line. Links to records go through `lib/hrefs.ts` (`memberHref(id)`, `groupHref(id)`, `taskHref(id)`, `suiteHref(id)`, `projectHref(id)`); ask for one it lacks rather than writing your own.

### Legacy components you mount but don't own

A shared component another place still uses (`CommunityMembersTable`, an old chart) is mounted as it is: don't restyle or fork it. List it in your report under "For the system owner" with what looks off.

### Who owns what

You own your area's page folders, and three edits in the shell, which are yours whatever a brief says:

- your places' and records' lines in `src/routes.ts`, pointed at your new route files;
- the `tabs` of a record in your area in `RECORDS` in `src/places.ts`, while nothing links to its tab ids (the suite's `launch` and the form's `responses` and `versions` are fixed; the task, suite and project tabs come from `PLACES.md`);
- a record's `tab` in `RECORDS` when it is listed under a non-first tab of its place.

Everything else in the shell (`src/shell`, the rest of `places.ts`, `legacyRoutes.ts`), tokens, `src/ui` and this guide has one system owner: a new route, place, tab or view, or a changed id or path, goes through them, since redirects and the palette point at these. If a page needs a component, variant, token or template this guide lacks, don't build a local one, since ten local variants are ten products: put the ask in your report under "For the system owner", tell your lead, and meanwhile compose the nearest existing pieces. If the guide is wrong, say so under "Guide problems" rather than working around it: the fix goes in the guide, so every page gets it.

## Templates

Every place uses one template. The template fixes the page's skeleton, so two pages of the same kind differ only in content. Pick it from the **Template map**; for a place not on it, pick by the first table below. All paths are under `apps/admin/src/ui/templates/` unless they start with `ui/`.

| Template          | Use it when                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **List**          | The page's job is finding one or several of many things of one kind, then opening or acting on them.                   |
| **Record**        | The page is one thing with an identity and a URL: a task, a suite, a member.                                           |
| **Overview**      | The page summarizes several kinds of thing at a glance and links onward; it owns no data of its own.                   |
| **Workspace**     | Staff stay on the page for a long stretch working in panes that scroll separately: a builder, a conversation, a graph. |
| **Settings form** | The page is one form, or a few short ones, for a singleton: no list, no record identity.                               |

Two flows sit on top of a page rather than being one: **Dialog** and **Sheet**.

| Template      | Pieces                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page    | `Page` (`Page.tsx`). `usePlaceTabs`, `usePlaceViews`, `useRecordTabs`, `withQueueCounts` (`usePlaceTabs.ts`), `Banner` (`Banner.tsx`), `ContentState`, `ErrorState`, `RefreshFailedBanner`, `TableSkeleton`, `FormSkeleton`, `LOAD_FAILED_FALLBACK` (`States.tsx`). |
| List          | `Page fill`, then `FilterBar` with `SearchField`, filters, `FilterChip`; `useListSearch`, `listCount`; `ListContent`; `ListFooter`; `ViewSwitch`; `BulkBar` (all `List.tsx`). Table from `ui/Table.tsx` with `bleed`.                                               |
| Record        | `RecordBody` with `SidePanelSection`, `FactList`, `Fact` (`Record.tsx`), or `PageBody` when there is no side panel.                                                                                                                                                 |
| Overview      | `PageBody`, `Section`, `OverviewGrid`, `Panel`, `StatTile`, and inside a panel `PanelControls`, `PanelStack`, `PanelNote`, `PanelStat`, `DateRangeFields`, `NumberField` (`Overview.tsx`; see **Charts**).                                                          |
| Workspace     | `Page fill`, then `Workspace`, `WorkspaceToolbar`, `PaneHeader` (`Workspace.tsx`).                                                                                                                                                                                  |
| Settings form | `PageBody width="form"`, `FormSection`, `Field`, `FieldGroup`, `CheckboxField`, `SaveBar`, `SAVE_FAILED_FALLBACK`, `useFocusFirstInvalid` (`Form.tsx`).                                                                                                             |
| Dialog        | `ui/Modal.tsx`: a `<form>` holding `ModalHeader` with `ModalTitle`, `ModalBody`, then `ModalFooter` (its `error` shows a refusal above the buttons) with `ModalActions` (Cancel, then the primary submit). A confirmation is `confirm()` or `ui/ConfirmDialog.tsx`. |
| Sheet         | `ui/Sheet.tsx`, `size="peek"` for a look at one row, `"wide"` for a form or table.                                                                                                                                                                                  |

### The page file

A route's component returns one `Page`. This is a List place with tabs, the reference page cut down; the other templates change only what is inside `Page`.

```tsx
const TABS = ["all", "awaiting"] as const;
type Tab = (typeof TABS)[number];

export default function GroupsPage() {
  const tabs = usePlaceTabs(PlaceId.Groups, TABS);
  const groups = useCommunitiesAdmin(); // today's hook, unchanged
  const queue = useGroupAssignmentMembersAdmin();
  const [creating, setCreating] = useState(false);
  const body: Record<Tab, () => ReactNode> = {
    all: () => <AllGroupsTab groups={groups} />,
    awaiting: () => <AwaitingTab queue={queue} groups={groups} />,
  };
  return (
    <Page
      fill
      place={PlaceId.Groups}
      description={`Unused capacity ${capacity}`}
      actions={
        <Button
          // Awaiting assignment has its own primary, Confirm assignments.
          variant={
            tabs.value === "all" ? ButtonVariant.Primary : ButtonVariant.Default
          }
          onClick={() => setCreating(true)}
        >
          New group…
        </Button>
      }
      tabs={withQueueCounts(tabs, {
        [CountId.AwaitingGroup]: queue.isLoadingError
          ? null
          : queue.data?.length,
      })}
      banner={<RefreshFailedBanner things="groups" query={groups} />}
    >
      {body[tabs.value]()}
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </Page>
  );
}
```

A tab's body, or the body of a page without tabs, is the filter bar and the content in its states:

```tsx
export function AllGroupsTab({ groups }: { groups: UseQueryResult<CommunityDto[]> }) {
  const [q, setQ] = useListSearch();
  const rows = useMemo(() => /* today's data, filtered by q */, [groups.data, q]);
  return (
    <>
      <FilterBar count={listCount({ shown: rows.length, total: groups.data?.length, noun: "group" })}>
        <SearchField label="Filter groups" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={groups.isPending}
          skeleton={<TableSkeleton bleed columns={4} />}
          error={groups.isLoadingError ? adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK) : null}
          errorTitle="Couldn't load groups"
          onRetry={() => void groups.refetch()}
          retrying={groups.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No groups yet"
        >
          <Table bleed>…</Table>
        </ContentState>
      </ListContent>
    </>
  );
}
```

- **`place`** is the `PlaceId` (`src/places.ts`) the page is. From it `Page` sets the document title, the breadcrumb and the one `h1`; don't write a `<title>`, a trail or a header by hand. A record's page passes `record={RecordId.Suite}` instead, with `title={suite?.name}` (until the name loads `Page` shows the record's kind from `places.ts`), and `parents={[{ label, to }]}` when it sits under another record. A record listed under a non-first tab of its place has that `tab` in `RECORDS`, and `Page` adds the tab to the breadcrumb. `badge`, `description` and `actions` fill the rest of the header. A `description` that comes with the data passes `""` until it loads: the line is held, so the tabs don't drop when it arrives.
- **Tabs and views** come from `places.ts`, which the redirects, the palette and the sidebar also read. `usePlaceTabs(place, ids)` binds a place's tabs to `?tab=`, `usePlaceViews(place, ids)` its views to `?view=`, `useRecordTabs(RecordId.Suite, ids)` a record's tabs. `ids` repeats the ids from `places.ts`, so `tabs.value` is a typed union to index a `Record<Tab, …>` with, and the hook throws if they differ. Only the current tab's body is mounted, so state two tabs need lives in the page file or the URL, and an unsaved form on a tab is lost on leaving it unless `useLeaveGuard` asks first. A tab whose `places.ts` entry has a `count` shows that queue's size through `withQueueCounts` (hidden at zero and while loading, "!" when it failed), as the sidebar does. Another count beside a tab label only where today's page has it: set `count` on that item.
- **Tabs of different kinds** (a list tab beside a form tab, as Media's): `fill={FILLS[tabs.value]}` following each tab's template; a non-list tab has no filter bar; one description covers the place. A tab that owns its query or mutation renders its banners as the first child of its own body.
- **`fill`** makes the page take the frame's height so only its body scrolls: always on List and Workspace, never on the others, which scroll with the frame.
- **`banner`** takes one banner or several (a fragment). A record most of whose instances show a standing banner passes `bannerPending` while it loads, so the body doesn't drop when the banner lands; where data already cached (the list the visit came from) says whether there is a banner, decide from that and hold the line only when nothing is known (`GeneralUpdatePage.tsx`). A List's table with no filter bar above it gets a 12 px gap from `ListContent`, so it doesn't touch the description.
- The body brings its own padding: `ListContent` and `Workspace` run edge to edge; `PageBody` and `RecordBody` pad and space their children. Don't add page margins yourself.

### List

Anatomy, top to bottom:

1. **Page header.** The place's name as the page's one `h1`, an optional one-line description under it, and on the right at most one primary action plus secondary actions. The primary action creates the thing listed ("New suite"). One primary per view: on a tab with its own primary, the header's create is Default. A list-wide number that isn't the row count (Unused capacity) goes in the description.
2. **Tabs**, when the place has them in `PLACES.md`.
3. **Filter bar** (`FilterBar`), when the list has a search, a filter or a list-wide action; in a place with tabs, every list tab renders one if any does, so the list starts at the same height on each. A list with none omits it, and its count goes in the description. Search field first, then filters, then on the right the count (`listCount`, which is empty while loading or empty, so "0 groups" never sits beside "No groups yet") and list-wide actions. Controls are the small size (`size="small"`). An applied filter shows as a `FilterChip`. Offer only the filters and sorts today's page has; the server pages and filters some lists and not others, and the data hook decides. The one addition allowed everywhere: a search by name over a list the hook already loads whole, kept in `?q=` by `useListSearch`; no search on rows that have no name.
4. **Body** (`ListContent`, the only part that scrolls). A table, edge to edge with no card around it (`<Table bleed>`), when rows share columns that staff compare. A stack of cards (`<ListContent cards>`) when each item is several lines of prose or holds its own controls (tags, organizations, partnership responses, the projects board).
5. **Footer** (`ListFooter`): pagination, only where the data hook paginates.

A list that offers views of the same items (Tasks: Timeline, List, Priority; People: Table, Map) puts `<ViewSwitch label="View" {...usePlaceViews(place, ids)} />` in the header's actions for a two-way switch, or passes the views as `Page`'s `tabs` when there are three or more and the place has no tabs of its own, and keeps the filter bar across views.

### Record

1. **Record header** (`Page`'s `title`, `badge`, `description`, `actions`). Title as `h1`; the status badge directly after it; one muted line of facts under it (kind, parent links, the one or two numbers that matter). On the right: at most one primary action, secondary actions, and a "More" menu for the rest; a record whose only header action is its delete shows it as a `DangerOutline` button. The breadcrumb carries the way back; don't add a back link.
2. **Tabs**, from `PLACES.md`, in that order. The first tab is the one staff most often want on arrival, not an empty summary.
3. **Body** (`RecordBody`): a main column, plus a **side panel** (its `side` prop; 320 px, moving above the main column in a narrow frame) when the record has about four or more standing facts worth seeing on every tab's first screen. The side panel is a `FactList` of `Fact`s. A value there is editable in place only if today's control for it already saves at once; otherwise it links to the tab that edits it. No side panel when a tab needs the full width.
4. A **standing banner** (`Page`'s `banner`) for a fact that changes what every action on the page means: "Nothing is visible to members until you launch" on a draft suite. Not for tips.

A record with one screen of content has no tabs; one whose sections are different jobs gets a tab per job. A record that is mostly one form (contract, formula, general update, member list) is still a Record; its body follows **Forms**. While the record loads, fails or isn't found, the header and tabs stay and `ContentState` fills the body:

- **Skeleton** shaped like the current tab's body: `RecordBody` with a side block, `FormSkeleton` for a form, or a card holding `TableSkeleton` (`GroupPage.tsx`).
- **Not found** is the empty state, with a button to the place's list; "It may have been deleted." only where delete exists. An id that can't exist (a non-number where ids are numbers) is not found at once, with no request for it.
- **Create** with more fields than a dialog holds (more than about six controls, or taller than 720 px) is the record's page at `/new`: `record=`, `title="New {thing}"`, no tabs, the same fields component as the record's edit, `SaveBar saveLabel="Create {thing}"`, Discard resets, and the page keyed by id so leaving `/new` for the created record starts clean.

### Overview

A page header, then sections in one column (`Section`), each a heading and a card or a row of cards on a 12-column grid (`OverviewGrid`; children take `col-span-*`). A card with a title row is a `Panel` (`flush` around a table), a number is a `StatTile`. Order sections by what needs action first, then what informs. A section links to the List that holds its full data. Stat tiles show a label, a number and nothing the server doesn't provide: no deltas or sparklines unless today's page computes them. A panel whose refetch fails keeps its content and shows `RefreshFailedBanner inline`. Home's content is fixed by `REQUIREMENTS.md`: the four queues in order, each only when above zero, then the stats; "Nothing needs you right now" as one line when all are zero.

### Workspace

`Workspace` fills the frame under the page header (`Page fill`); the page itself never scrolls, each pane does. Up to three panes: **navigator** (left, 288 px), **canvas** (center, the children), **inspector** (right, 320 px: properties of the selection, or context). A `WorkspaceToolbar` across the top holds mode switches, undo and redo, the save state and the primary action. When a workspace is a tab of a Record, the record header stays above it.

- **Selecting never moves the page.** Selecting an item changes the inspector's content and the selection highlight, and nothing else. Always pass `inspector`, and when nothing is selected have it say what to select, so the pane keeps its place. The owner named this defect in today's form builder.
- Panes keep the template's widths; a pane may collapse only by a labelled control.
- Reordering by drag also works without dragging (move up, move down, or a menu), per WCAG 2.5.7.
- The canvas of the form builder renders the member-facing form renderer and must look as it does in the member app; admin chrome sits around it.
- Adding an element opens a searchable picker listing only field and block types that exist today (`DATACHECK.md` names eight the prototype invented).

The form builder is the three-pane case: outline, canvas, inspector, the owner's firm pick; the rest of the prototype's builder is mood only. Design it from today's builder and `inventory/forms.md`, and where a detail is your call, say so in your report. Forms have no draft or publish step: no "Publish changes", "Published" badge or version numbers. The toolbar shows today's save control and state, and on a launched task says that a save is live for members on their next load.

### Settings form

A page header, then one column (`PageBody width="form"`) of `FormSection`s, each a heading, optional one-line description, and its fields, with one save control (its `footer`, usually a `SaveBar`) per independently saved form. Sub-groups inside one saved form are an `h3` at body size above a divider, not a card in a card.

### Dialog and Sheet

|            | Use it for                                                                                                                                                                  | Not for                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Dialog** | A decision, a confirmation, or creating something from up to about six controls that fit 720 px tall (New suite: a name). Blocks the page.                                  | Anything needing a look at the page behind it; anything with tabs; long forms.   |
| **Sheet**  | Looking at or lightly editing one item from a list while the list stays in view: a member from People, a forum post, a task update from Messages. Slides in from the right. | Records staff work in for long. Those get a page; the sheet offers "Open" to it. |
| **Page**   | Everything else. A flow with consequences for members (suite launch) is a page, so it has a URL, survives a reload and has room for its checks.                             |                                                                                  |

A dialog's form follows **Forms**. While its write runs, the submit button is `busy` and the dialog can't be dismissed (`dismissDisabled`); a refusal shows in `ModalFooter`'s `error`, and the dialog stays open with what was typed. Mount the dialog only while it is open (`{creating && <NewGroupDialog … />}`), so each opening starts clean. Keep the title short.

The sheet's open item is in the URL (see **URL state**), so a copied link opens the same item and Back closes it. Up and down controls in the sheet header (`headerActions`) step through the list's rows.

## Template map

Every place in `PLACES.md`. Where a place's tabs differ in kind, the place takes the List skeleton (header, tabs) and each tab's body follows the template named.

| Area     | Place                 | Template      | Notes                                                                                                                                                       |
| -------- | --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | Home                  | Overview      | Queues, then stats.                                                                                                                                         |
| Inbox    | Inbox                 | Workspace     | Thread list, conversation, member context. Needs reply and All are its tabs.                                                                                |
| Tasks    | All tasks             | List          | Views: Timeline (default), List, Priority. Priority is a reorderable list; give it a non-drag route.                                                        |
| Tasks    | Suites                | List          | New suite is a Dialog with a name only.                                                                                                                     |
| Tasks    | Projects              | List          | Card body: today's board, its sections and health flags.                                                                                                    |
| Tasks    | Forms                 | List          | Each form labelled by its task. No "New form" button.                                                                                                       |
| Tasks    | Formulas              | List          |                                                                                                                                                             |
| Tasks    | Contracts             | List          | Grouped: active, scheduled, inactive.                                                                                                                       |
| Members  | People                | List          | Tabs All, Staff, Away; views Table, Map. A member opens in a Sheet.                                                                                         |
| Members  | Welcome queue         | List          |                                                                                                                                                             |
| Members  | Groups                | List          | Tabs All groups, Awaiting assignment.                                                                                                                       |
| Members  | Clusters              | List          | Summary line in the header; card body.                                                                                                                      |
| Members  | Tags                  | List          | Card body, edit in place.                                                                                                                                   |
| Members  | Member lists          | List          |                                                                                                                                                             |
| Members  | Friend graph          | Workspace     | One canvas pane, controls in an inspector.                                                                                                                  |
| Growth   | Invites               | List          | Tabs Invites, Invite links: List. Invite graph: Workspace canvas. Live feed: Overview body with a Full screen button. Message template: Settings form body. |
| Growth   | Waitlist              | List          | Tabs Entries, Emails.                                                                                                                                       |
| Growth   | Links                 | List          | Tabs Share links, Custom links, Share targets, Hosted docs; a tab's create form sits above its list as today.                                               |
| Growth   | Organizations         | List          | Card body.                                                                                                                                                  |
| Growth   | Outreach partnerships | List          | Card body.                                                                                                                                                  |
| Growth   | Ambassador program    | List          | Check `inventory/growth.md`; if it is mostly settings, use Settings form and say so.                                                                        |
| Content  | Task updates          | List          | An update opens in its task's Messages tab.                                                                                                                 |
| Content  | General updates       | List          | Grouped by status.                                                                                                                                          |
| Content  | Forum posts           | List          | A post opens in a Sheet.                                                                                                                                    |
| Content  | Media                 | List          | Tabs Image upload (Settings form body: an upload, no library), Videos.                                                                                      |
| Activity | Event log             | List          | New rows stream in at the top; announce them without moving focus.                                                                                          |
| Activity | Scheduled jobs        | List          | Rows expand to their members. No search or filters today: no filter bar.                                                                                    |
| Research | Kora participants     | List          | Tabs Participants (totals, signups, the tables, the export), Assignments (project status, transcript batches, notices, results).                            |
| Settings | Settings              | Settings form |                                                                                                                                                             |
| —        | Login                 | unchanged     | Outside the shell.                                                                                                                                          |

Records:

| Record                                                                        | Template                                      | Tabs, side panel                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task                                                                          | Record, side panel                            | Overview, Form, Variants, Follow-up forms, Messages, Responses, Events, Activity. Form tab body is the builder Workspace. Every capability the decision "The task journey is `CUJ-TASK.md`" lists keeps a place here. |
| Suite                                                                         | Record, side panel                            | Timeline (Overview while a draft), Tasks, Events, General updates, Partition (behind its flag), Launch.                                                                                                               |
| Suite › Launch                                                                | Record tab, no side panel                     | Checks in one column, with a sticky summary box on the right holding what launch creates, the blockers and the Launch button.                                                                                         |
| Project                                                                       | Record, side panel                            | Tasks by suite, Timeline, Task updates. Keeps staff testing and "Schedule release".                                                                                                                                   |
| Form                                                                          | Record, no side panel                         | Builder (Workspace), Responses, Versions.                                                                                                                                                                             |
| Member                                                                        | Sheet from any list; Record for the full page |                                                                                                                                                                                                                       |
| Group, Member list, Formula, Contract, General update, Video, Kora assignment | Record                                        | No tabs unless today's page has sections worth them. Video sits under Media's Videos tab (`tab` in `RECORDS`).                                                                                                        |
| Task update                                                                   | Sheet over the task's Messages tab            |                                                                                                                                                                                                                       |
| Kora transcript preview, Invite live feed full screen                         | Full screen, no shell, as today               |                                                                                                                                                                                                                       |

## Layout and density

One density, Comfortable, with the prototype's values. No density switch. The templates and components set row, control, tab and pane sizes; these tokens are for the rare element you lay out yourself.

| Role                                                        | Value                                      | Token class                                                             |
| ----------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Page side margin; page header top padding                   | 32 px; 28 px                               | `px-page`; `pt-page-top`                                                |
| Gap between sections and between cards                      | 20 px                                      | `gap-section`                                                           |
| Card padding; bar vertical padding                          | 20 px; 14 px                               | `p-card`; `py-bar`                                                      |
| Corner radius: small controls, controls, cards and overlays | 4; 6; 10 px                                | `rounded-sm`; `rounded-md`; `rounded-card`                              |
| Motion: hover and press, small transitions, overlays        | 100; 160; 220 ms, off under reduced motion | `duration-fast`; `duration-base`; `duration-slow`, with `ease-standard` |

- Other spacing uses Tailwind's scale (`gap-2`, `p-3`, `w-80`), and controls you size yourself use `h-control` (34 px) or `h-control-sm` (30 px); never a bracketed value.
- Spacing between things comes from the template and from stack and grid gaps. If you're adding a margin to make something line up, the structure is wrong.
- Left edges line up: page title, tabs, filter bar and the first table column share the page margin.
- The owner chose this density because the tighter one read as cluttered. Don't add secondary labels, hint footers, inline shortcut keys or decorative counts to fill space. A fact today's page shows that the prototype hides stays reachable by keyboard: behind an `InfoTip` (`ui/InfoTip.tsx`, a small info button that opens on hover and focus) beside the heading, label, column header or single value it explains, or, when each row has its own, in the row's detail row (**Tables**, expandable rows) or a column, since an `InfoTip` per row is a tab stop per row. A `title` attribute alone is only for the whole of a truncated text and the absolute time of a relative one, never a fact's only home.
- Design for 1280×720 up to wide screens: a table may scroll sideways inside its container, the page never does.

## Typography

One sans family (Inter, set on everything), one mono (`font-mono`). Roles, not sizes. `Page`, `Section`, `Panel`, `FormSection` and `StatTile` set their own titles: a `Panel` or `FormSection` title is `h2` at `text-heading`, and a `Panel` inside an Overview `Section` becomes `h3` by itself.

| Role         | Class                                | Use                                                                     |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| Heading      | `text-heading font-semibold` (16/24) | A heading you write yourself, at the next level down; never skip one.   |
| Body         | `text-body` (13.5/21), the default   | Everything unless a row here says otherwise.                            |
| Small        | `text-caption font-medium` (12.5/16) | Table headers, metadata, badges, help text.                             |
| Reading text | `text-base/6 max-w-prose` (16/24)    | Prose staff read at length: an update's body, a contract, a transcript. |
| Mono         | `font-mono text-xs`                  | Ids, variables, code, JSON. Not for numbers in tables.                  |

Emphasis is weight (medium, semibold), never a second colour. Muted text is for what the eye may skip, and it still meets 4.5:1. Numbers that line up in a column use tabular figures.

## Surfaces and colour

Four layers, and hierarchy comes from borders and the layer change, not shadows.

| Layer               | Classes                         | Use                                                                                                 |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Page background** | `bg-canvas`                     | The page, the sidebar, a Record's side panel, a Workspace's navigator and inspector.                |
| **Raised surface**  | `bg-surface border border-line` | Cards, tables, the Workspace canvas items, inputs (`border-line-control`). One border, no shadow.   |
| **Sunken surface**  | `bg-surface-2`                  | Table header row, row hover, read-only wells.                                                       |
| **Floating**        | `bg-surface shadow-pop`         | Menus, popovers, sheets, dialogs, the palette, the bulk bar, toasts. The only things with a shadow. |

Text is `text-fg` or `text-fg-muted`; dividers `border-line`, stronger edges `border-line-strong`. Each of `accent`, `success`, `warning`, `danger` and `info` has a `-soft` background (`bg-danger-soft text-danger`). `ui/tokens.test.ts` checks the contrast of the pairs in use: add a pair there when you pair two tokens it doesn't list.

- A card groups content that belongs together and could be moved as a unit. Don't put a card in a card; use a divider or a sunken row inside.
- On a List the table is the page: no card. On a Record or Overview a table sits in a `Panel`.
- **Accent** marks the primary action, the current selection, links and focus. One primary button per view.
- **Success, warning, danger and info** mean only that. Never use them for a category, a role, emphasis or an unread mark.
- **Category colours** (projects) are the tokens `cat-1` to `cat-6`, each with a `-soft` background. The server stores no colour, so pick one from the project's id (`hashString` in `lib/identitySwatch.ts`), and always show it beside the project's name.
- A `Banner` takes `BannerTone.Info` for a standing fact, `Warning` for a consequence to weigh, `Danger` for a violation, blocker or failure; it says the thing in words. `inline` puts it in the body as a box.
- Light theme only. Every colour is a semantic token so a dark theme is a second set of values.

## Status badges

A status is always a badge with a word (`ui/Badge.tsx` with a `BadgeTone`). Never a dot, a coloured row, a coloured number or an icon alone (owner requirement, and WCAG use of colour); where there is no room for the word, drop the status from that spot. The same status has the same word and tone on every page: a task's or suite's phase is `<PhaseBadge status>` (`ui/PhaseBadge.tsx`; `phaseLabel` for the word alone). Don't use `ACTION_STATUS_LABELS` or `ACTION_STATUS_COLORS` in redesigned pages.

Phase order everywhere (columns, legends, strips): Draft, Planned, Members taking action, Office taking action, Resolution, Completed, Failed, Abandoned. A status the data holds is shown, though no control sets it. A suite's badge is the phase of its two shared events; its tasks may be further along.

For other statuses pick the tone by meaning: neutral for inactive or not started, success for done or healthy, warning for needs attention soon, danger for failed or blocked, info for in progress or scheduled. Two statuses that share a tone must still differ by their word. A role, kind or type (Leader, Member, a job's kind) is not a status: plain text or a neutral badge, never accent or a status tone. A count that asks for attention (queue counts) is a count badge in the sidebar and palette, not a status; Home (**Home's states**) and a place's tab (`withQueueCounts`) show the exact number.

## Tables

`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `ui/Table.tsx`: heights, the sticky header, hover and the selected tint (`aria-selected` on the row) are built in. `bleed` on a List; none inside a `Panel flush`.

- **First column** names the row, medium weight. A row with a record links its name to it (`className={nameLinkClass}` from `ui/styles.ts`); a member is `PersonCell` (`ui/PersonCell.tsx`, which renders its own cell: `<PersonCell userId name profilePicture firstColumn />`). A member anywhere else (a sentence, a list, a fact, a detail row) is `PersonChip` from the same file, with `link` when the name should open their record; don't compose an avatar and a link by hand. A row with no record shows its identifying fact, not as a link. No row click: the name link opens the row, and open-in-new-tab works. Other links take `linkClass`.
- **Alignment**: text and dates left; numbers right, with their header right too (`text-right tabular-nums`); a status badge left. Never center. An id column is left, mono, muted.
- **Numeric columns** show the unit in the header ("Time (min)"); a unit that varies by row stays in the cell. A value the server doesn't have is "—", never 0. Nothing but the number goes in a numeric cell.
- **One line per row.** A message about a row's control goes in the cell beside it. A long text column takes `TableCell truncate` (capped near 260 px, the full text as its tooltip; pass `title` when the child isn't a string). A row that needs two lines is a card, not a tall row.
- **Widths**: don't size columns. Where one must hold, give the same classes to `TableSkeleton`'s `columnClassNames`, so nothing jumps when rows land.
- **Header** is sticky, sentence case, and a sortable header is a button that shows its direction and sets `aria-sort`. Sort only by what today's page or the data hook sorts by.
- **Row actions** go in `TableCell actions` under `<TableHead actions>Actions</TableHead>` (a name for screen readers only). The action staff take most is a small labelled button; the rest go in a "More" menu, though two short actions may both show. Visible at rest, not only on hover. Each button's `aria-label` starts with its visible label and names the row ("Remove from group: Sam Lee"); where names repeat, add what tells rows apart ("Delete: output.m3u8, video 36"). Two actions on one row must not be ambiguous ("Remove leader" beside "Remove from group", not "Remove"). After a row's own control removes the row, move focus to the next row's control, else the previous row's, else the list's add control (`GroupMembersTab.tsx`).
- **Grouped rows** (contracts, general updates by status) are one table with `TableGroupRow colSpan label count` between groups, not separate tables; a list grouped by status puts the badge in `label` and has no status column.
- **Expandable rows** (scheduled jobs, event data): `ExpandToggle expanded controls onToggle` in a left-aligned column of its own (it leads with a chevron), its words saying what opens ("12 members"), and `TableDetailRow id colSpan` under the row, mounted only while open.
- **Selection** exists only where today's page has an action on several rows. Checkbox column first; the header checkbox selects the loaded rows and says how many. `BulkBar`, the last child of the page's body, says "N selected", lists the actions with words, and Escape clears the selection.
- **Pagination** (`ui/Pagination.tsx` in a `ListFooter`) follows the data hook: numbered pages where the server pages, none where the list loads whole. Don't add infinite scroll.

## Forms

`Field` (`templates/Form.tsx`) lays out the label, help and error and hands its child the `id` and ARIA props, which every control below takes: `Input`, `Textarea`, `Select`, `DateTimePicker`, `DateField`, `FileInput` from `ui/`. Several controls answering one question (checkboxes, a pair of dates) sit in `FieldGroup label help error disabled`, a `fieldset` with a legend, its help above the controls; it may hold `Field`s, and a part of the form that fails to load (the suites to pick from) says so in its group's `error`. A checkbox with its label and explanation is `CheckboxField`; a switch is `Switch`. `UserSelect` brings its own label (`label=`), takes `disabled` and a `hint` for when nothing is picked, and doesn't go inside a `Field`. A form whose fields serve both a create and a record's settings is one fields component used by both (`GroupSettingsFields.tsx`). `FormInput` and `LargeCheckbox` are the old pages'.

- **Label above its control**, sentence case, no colon. Help text sits under the control in small muted text and stays visible when an error shows. A placeholder is an example at most.
- Mark the minority with `mark`: where most fields are required, mark the optional ones; where most are optional, the required ones. No bare asterisk.
- One column. Two fields share a row only when they are one thought (start and end).
- **Errors** appear under the field when the reader leaves it or submits, say how to fix it, and clear once fixed. A failed submit keeps every value and focuses the first bad field (`useFocusFirstInvalid()` gives the form's `ref` and a function the submit handler calls); a form with more than a few fields leads with a summary linking to each. Put `noValidate` on the `<form>`.
- **A field that only sometimes applies stays rendered**, disabled, with its help saying why.
- **The submit button stays enabled** and reports what's wrong when pressed, unless today's page disables it as a guard (Launch while blockers remain): then the reason is visible text beside it.
- **A button whose write is running takes `busy`** (`ui/Button.tsx`): it keeps its label and focus, shows a spinner and ignores presses. Don't swap the label for "Saving…" or disable it.
- A switch takes effect at once; a setting saved by a Save button is a checkbox.
- A file is `FileInput` (controlled `value: File[]`; set it back to `[]` to clear). A form whose button uploads or runs something rather than saving passes `SaveBar`'s `stateText` (`{ saving: "Uploading…", saved: "Uploaded", failed: "Couldn't upload" }`, keyed by `SaveState`).

### Dates and times

- An instant members experience (an event, a deadline, an update's start or end, a scheduled job) is shown in `LAUNCH_TIME_ZONE` (`lib/launchTimeZone.ts`) through `formatDateTime(…, { timeZone })`, which ends "PT", and edited with `<DateTimePicker timeZone={LAUNCH_TIME_ZONE}>`, labelled `` `Start date (${timeZoneLabel(LAUNCH_TIME_ZONE)})` `` ("Start date (Pacific time)"). `onChange` reports `utcValue`, the UTC instant. A wall-clock time the spring change skips moves an hour later; a repeated autumn hour takes its first occurrence.
- A staff-side audit time (created, updated) uses `formatDateTime` with no zone.
- A date-only value or range is `DateField` (`YYYY-MM-DD`; `lib/dateInput.ts` turns it into instants).
- A time the server only samples or approximates is shown at its real precision ("by Wed, Nov 25"), never to the minute.
- Never default an event's date to now.

### Saving

Keep each page's save model as it is today; the model is part of the data layer you reuse, and on a launched task a save reaches members.

| Model                  | Where                                                                           | What the page shows                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Explicit save**      | Most forms: task details, contract, general update, formula, the form builder.  | A `SaveBar` at the foot of the form, always rendered: primary "Save changes", "Discard", and its `SaveState`. |
| **Immediate**          | A control that today writes on change: a switch, the project picker, a tag add. | The control itself shows pending and failure; failure puts the old value back and says why.                   |
| **Create in a dialog** | New suite, New group.                                                           | A "Create suite" button; on success a toast and go to the new record.                                         |

- Don't turn an explicit save into autosave. An update's first content save publishes it, and a form save on a launched task is live for members on their next load.
- **Unsaved changes**: every explicit-save form calls `useLeaveGuard` from `lib/useLeaveGuard.ts` with its dirty state. Pass `allowSamePath` when the unsaved state survives a tab or filter change on the same path. After a save that navigates, use the function it returns.
- Before saving, the content check in `components/useContentConfirm.tsx` still runs wherever it runs today.
- A save that reaches members at once says so before saving, in `SaveBar`'s `note` (its own line above the buttons; pass `""` in states with no note so the line is held): a launched task's details, form or variant; an update's first content save; a reminder group. The note says what the save will store, as the endpoint stores it.

## Empty, loading, error

- **Loading.** The first load of a page or tab shows a skeleton shaped like the content, with the header, tabs and filter bar already in place. `ContentState` lays the skeleton out at once and shows it after about 200 ms, so fast loads don't flash and nothing below moves; build it from `TableSkeleton`, `FormSkeleton` or `ui/Skeleton.tsx` blocks sized like the content. For anything else, `useDelayedFlag` (`templates/useDelayedFlag.ts`) is the delay.
- **Nothing yet** (`ContentState`'s `emptyTitle`, or `ui/EmptyState.tsx`): names what is empty and offers the next step where there is one. On Home and queues, an empty queue is good news and says so in one line.
- **No results**: filters or search matched nothing. `ContentState` says so and offers "Clear filters".
- **Failed to load** (`ContentState`'s `error`, or `ErrorState`): the title says what couldn't load, the reason is `adminRefusalMessage(error, LOAD_FAILED_FALLBACK)`, "Try again" retries with `retrying={query.isFetching}`. Use the query's `isLoadingError`, so a failed refetch keeps what loaded. When part of a page fails, the rest still renders and a `Banner` names the failed part and what that means for what's shown. A failed load never looks like an empty list.
- **Failed refetch.** Content already on screen stays, and `<RefreshFailedBanner things="groups" query={query} />` says it may be stale, with a retry. It renders nothing unless `query.isRefetchError`, so mount it always: in `Page`'s `banner`, as the first child of a tab body that owns its query, or `inline` in a panel. It shows only after the client's retries, about 7 s after a server error or lost response and at once when the server refuses; to see it in a browser, load the page, leave it, make the request fail and come back. A reload the reader asked for with a button is not a refetch: its failure replaces the earlier result with the failed state, so an old answer isn't read as the new one.
- **A failed write is said once, where the reader is looking**, and stays until dismissed or the next success: an explicit save in its `SaveBar` (`error` is the reason alone, fallback `SAVE_FAILED_FALLBACK`); a dialog's write in `ModalFooter`'s `error`, and nowhere else; a write confirmed in a `ConfirmDialog` that closes once the write settles, as an `InlineError` beside the control that opened it (`AwaitingTab.tsx`); a write from a row or a header button as `Page`'s `banner`, a `BannerTone.Danger` `Banner` with a Ghost small "Dismiss". No toast for a failure.
- **Refused by the server**: show the server's own message through `lib/adminRefusal.ts`. An expired session shows the session message from `lib/sessionExpired.ts`.
- **Permissions**: every signed-in admin can do everything; there are no roles to gate on. Don't hide or disable a control because an action is risky: admins may do almost anything given a warning that says what it breaks (ux-guidelines). A new block needs its own reason recorded in the spec's `DECISIONS.md`.
- A malformed thing fails loudly: a form whose schema has an error doesn't render a fillable preview.

## Confirmations

Three levels. Pick by what the action reaches, not by how nervous it feels; a confirmation on a routine action teaches staff to click through the ones that matter. Keep a confirmation today's page asks for, even on a reversible action; don't add one there.

| Level               | When                                                                                                                          | Form                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **None, with undo** | Reversible, reaches no member, and a reverse mutation exists today.                                                           | Not available until toasts have an action button: use Confirm where a mistake would cost work.                                                                                                                                                                                                                                                       |
| **Confirm**         | Irreversible or hard to reverse, staff-side: delete a tag, remove a group member or leader, archive a task, delete a variant. | Dialog. Title names the action and the thing (`Delete the tag “captain”?`; a person's name unquoted). Body says what is lost, who is affected and who is notified, from the endpoint. Buttons: "Cancel" and a verb ("Delete tag"), danger-styled when destructive, never the default. `confirm({ title, message, confirmLabel, destructive: true })` |
| **Typed phrase**    | Notifies or exposes real members.                                                                                             | Full dialog stating who is reached and that it can't be undone, then a field that must match the phrase exactly. `confirm({ …, requiredText })`                                                                                                                                                                                                      |

`confirm` comes from `useConfirmOnPage()` (`lib/useConfirmOnPage.ts`) and resolves to `true` or `false`; it closes, declined, when the path changes. It opens `ui/ConfirmDialog.tsx`; render that component yourself only when the dialog must stay open, `busy`, while the work runs, as a batch that can half-apply does. Its `message` is text; lines break at `\n`. A confirm button that names a count agrees with it ("Assign member" for one). When the confirmed write runs after the dialog closes, the button that opened it shows `busy`. Replace every `window.confirm` with the Confirm level (lint), keeping its wording's facts.

### Operations that reach members

`CUJ-TASK.md` section 4 is the full list with today's guard for each; `CUJ-SUITE.md` covers launch. Read both before touching a task, suite, project, update or reminder screen. The typed phrases are constants; import them, don't retype them, and don't reformat the number inside.

| Operation                                                                    | Phrase or guard to keep                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch a suite                                                               | Blockers first, then `notifyRealMembersText(count)`: "I am going to notify {n} real members", n unformatted. Then the re-read and ordered creation in `launchSuite.ts`. |
| Schedule release on a project task                                           | Staff testing first, then `notifyRealMembersText("many")`.                                                                                                              |
| Create a reminder group                                                      | `notifyRealMembersText(count)`.                                                                                                                                         |
| Populate default reminders                                                   | `notifyRealMembersText("many")`.                                                                                                                                        |
| Send an update's notification                                                | `notifyRealMembersText("many")`. Sending stays a separate step from writing and from publishing.                                                                        |
| Add a Members taking action event to a task or suite                         | `LAUNCH_CONFIRM_TEXT`: "launch to real members".                                                                                                                        |
| Schedule edit that moves a deadline earlier                                  | The server's 409 and `lib/confirmDeadlineShortening.ts`.                                                                                                                |
| Delete a suite event, unschedule a release, delete a reminder group, archive | Confirm level, as today.                                                                                                                                                |
| Correct a cohort decision                                                    | Its dialog with a required reason.                                                                                                                                      |

Rules from the spec's `DECISIONS.md` that the prototype breaks, and you must not:

- **No control sets a task's status.** Status is derived from events, and any event other than Draft makes a draft visible to members. No status dropdown, no "Abandon" command, no "Planned" marker.
- **An event's date never defaults to now**, and no "Launch now" default.
- **No inline date editing of events in a table.** A date moved into the past launches.
- **Creating and launching stay separate.** New task and New suite create a draft and nothing else. Tasks launch through their suite's Launch tab; adding an event to a task outside a suite is a deliberate path behind its typed phrase.
- **An update is not sent by a countdown.** Typed phrase, not "Sending in 10 s, Cancel".
- **Reminders, follow-up forms and updates stay three things**, each with its own screen and confirmation, even where one tab lists them together.
- **Variants keep stage-then-publish**, the over-100% block and the delete confirmation.
- Paste JSON keeps events off by default. Duplicate and Paste say what they copy.
- Visibility mode and public-only are two settings; name them so neither is mistaken for the other, and say what each exposes.
- "Preview as member" is not staff preview: turning staff preview on shows the draft to every staff account.

If your design moves or merges one of these screens, your report says where each guard now lives.

## Toasts

`useToast()` from `ui/ToastProvider.tsx` gives `success`, `error`, `info`, `warning` and `showToast`; redesigned pages use `success` and `info`. The provider is mounted once at the root and shared with the form renderer; don't mount another. Toasts keep the shared look for now.

- A toast confirms something the reader just did and could afford to miss: "Suite created", "Copied link". One short sentence, past tense, naming the thing. No "Successfully".
- `success(message, title)`: `title` renders as a heading above `message`, so pass the record's name there (`success("Group created", group.name)`) or nothing.
- Never for a failure, a warning, or anything needing action: those go where **Empty, loading, error** says, and stay. `lib/useRefusalToast.ts` is the old pages'.

## Charts

Charts come from `apps/admin/src/ui/charts`, and the pieces of the panels around them from `templates/Overview.tsx`; read the props in the files.

| Piece                                                                                     | Use                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DateAxisChart`, `NumericAxisChart`                                                       | Lines over dates, or over a numeric x such as weeks or hours since a start.                                                                                      |
| `ChartFrame`                                                                              | The box a chart you draw yourself sits in: it gives you the width to draw at, dims the chart while `updating`, and holds its `tip`.                              |
| `useChartCursor`                                                                          | The active mark for pointer and keyboard alike: spread `markProps` on the `<svg>`.                                                                               |
| `ChartTip`, `TipRow`                                                                      | The active mark's detail, kept inside the frame so it never covers a control outside the chart.                                                                  |
| `ChartLegend`, `LegendItem`, `SequenceLegend`                                             | The series' names, under the chart.                                                                                                                              |
| `chartColor.ts`                                                                           | `SERIES`, `chartColor` (grid, cursor, track, muted), `sequenceColor`, `heatCellClass`, `axisTextClass`.                                                          |
| `PanelControls`, `PanelStack`, `PanelNote`, `PanelStat`, `DateRangeFields`, `NumberField` | A panel's controls, first in its body: fields, then `actions` level with them. `PanelStat` is a number inside a `Panel`, where a `StatTile` is a card in a card. |

- **Colour.** Series take `SERIES` in order: neighbours alternate dark and light, 3:1 apart, so two series side by side differ without their hue. Success, warning, danger and info colour a series only when the series is that status. A set too long to name one by one, in an order (cohorts by age), takes `sequenceColor` and a `SequenceLegend`; a filled cell holding a value takes `heatCellClass` and shows the value. Pass colours as values from `chartColor.ts`: the lint reports colour literals in `fill`, `stroke` and `style`, and fixed lengths in `style`.
- **Size.** Draw at the width `ChartFrame` gives (`width={width}` with a matching `viewBox`) rather than scaling a fixed `viewBox`, so axis text keeps its size in a half-width panel; `xTickCount(width)` thins the ticks to fit.
- **Without a pointer.** Every value a tip shows can be reached without one: the `<svg>` takes focus and the arrow keys move the active mark, as the kit's charts do, or the values are on the page as text or a table. The `aria-label` names the chart and says how to read it.
- **A range change** keeps the chart on screen with `updating`. The skeleton is for a first load, or when there was nothing to keep.
- **Nothing in range** is `ContentState`'s `emptyTitle` ("No invites in this date range"), with no Clear filters.
- A panel's controls (ranges, weeks, a checkbox) are not URL state. A quick range ("Last 7 days") is a `Default` small button in `actions`. Ticks and tips format numbers with `formatCount`.
- Run the grayscale pass on any page with a chart.

## Home's states

- While the queue counts load, Home shows one skeleton line, and the list appears whole once all four settle. Its landing pushes the stats down; it is the one load allowed to move content on Home.
- A count that couldn't load keeps its row, showing "—" and saying the count couldn't load: a failed count is not an empty queue.
- Each row shows the exact number, not a `CountBadge` (which caps at 99+), then `QUEUES[id].label` and a button reading `QUEUES[id].open` to `queueHref(id)`, all from `places.ts`.
- A stat tile whose number comes from a query still loading or failed to load says so in its `note` ("Loading…", "Couldn't load"), so a "—" in the value is never left to say it alone. A failed refetch keeps the number and shows `RefreshFailedBanner inline` above the tiles.
- Stats stay on Home under the queues. Panels that compare well side by side take half the grid (`col-span-12 @4xl:col-span-6`); wide charts and tables take the row.

## Keyboard

- The shell owns `⌘K` (palette), `[` (sidebar), `?` (shortcut list) and `g` then `h`, `i`, `t`, `m`, `w`, `c`, `a`, `r` or `s` (go to an area). Don't bind these or anything that shadows a browser or OS shortcut.
- A page may use without registering: Escape to close the top layer then clear selection, `⌘Enter` to submit from a text area, arrow keys inside a composite widget with one tab stop for the whole widget. `SearchField` registers `/` itself.
- Any other shortcut is `useShortcut({ keys: "e", label: "Edit task", run })` from `shell/shortcuts.tsx`, registered while the component is mounted: `keys` is space-separated for a sequence (`"g t"`) and `"mod+s"` for ⌘ or Ctrl. It is then listed under "This page" in the `?` list. A single key or a sequence is ignored while the reader types or a dialog is open, and is under the shell's off switch (WCAG 2.1.4); a `mod+` shortcut runs anywhere, so guard its `run` where it must not act behind an open dialog. Two shortcuts throw when they share keys or one's keys start the other's sequence. Show the keys in the control's tooltip with `ui/Kbd.tsx`.
- Everything works by keyboard alone, in reading order, with visible focus. A dialog and a sheet trap Tab, close on Escape and return focus to what opened them.

## URL state

The URL holds what a colleague needs to see the same thing from a pasted link, and what Back should return to.

| State                                               | Where                                                                                                    | History                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Record, and the tab of a record or place            | Path for the record; `?tab=` through `usePlaceTabs` or `useRecordTabs`, the first tab being the bare URL | Push                                                           |
| View of a list (timeline, list, priority)           | `?view=` through `usePlaceViews`, the first view being the bare URL                                      | Push                                                           |
| Open sheet                                          | The record's route where one exists (`/content/posts/:postId`), else a search param naming the id        | Push, so Back closes it                                        |
| Search text, filters, sort, page                    | Search params named for the field (`q` through `useListSearch`, `status`, `sort`, `page`)                | Replace, so Back leaves the list instead of undoing keystrokes |
| Selection, expanded rows, scroll, a half-typed form | Not in the URL                                                                                           |                                                                |

- Defaults stay out of the URL, and an unknown value falls back to the default without an error.
- Bind `SearchField` straight to the search param: it keeps its own text while the URL catches up. Any other text input bound to the URL needs the same care.
- Changing a filter resets `page`. Changing a tab through the hooks drops every param but `view`; changing a view keeps them all.
- A place's tabs share one URL, so write a search param from the current ones (`setSearchParams((prev) => …)`): replacing the whole query drops `tab` and `view`. Link to a tab with `tabHref(placeById(PlaceId.Groups), { tab: "awaiting" })`, and to a record with `lib/hrefs.ts`. `lib/useSearchParamTab.ts` is the old pages'.
- Old URLs already redirect, query and hash kept (`legacyRoutes.ts`, tested by `routes.test.ts`); link to the new URLs.
- Launch progress stays in local storage as today, so a reload keeps it.

## Copy

- **Sentence case** everywhere: titles, tabs, buttons, table headers, menu items.
- **"Task", never "action"**, in everything staff read: "Task updates", "Suite" (not "Action suite"), "Scheduled jobs". Three exceptions: the phase names "Members taking action" and "Office taking action"; code, routes' internals, API fields and types; the typed phrases.
- **US spelling**: organization, canceled, color. **Straight apostrophes** ("Couldn't"), in JSX text too; curly quotes only around a name in a confirm title.
- **Dates** in `en-US` through `formatDate`, `formatTime` and `formatDateTime` from `lib/formatDate.ts`: "Nov 30", with the year only when it isn't this year, the weekday where the day of the week matters, time as "7:00 PM". Zones: **Dates and times**. A relative time ("2m ago") is for recent past activity only and carries the absolute time in its tooltip.
- **Numbers** get thousands separators through `formatCount` from `lib/formatNumber.ts`, except inside a typed phrase. A count with its noun is `countOf(n, "member")` ("2,911 members"), not `withCount`. A missing value is "—".
- **Failures.** A load: title "Couldn't load {things}", then the server's reason or `LOAD_FAILED_FALLBACK`. A write's fallback: "Couldn't {verb} {the thing}." ("Couldn't delete the group."), never "Unable to", "Failed to" or "Please try again". A `SaveBar` error is the reason alone. A field error is an instruction with no period ("Enter a title", "Choose an image to upload"); help text and dialog bodies are sentences with periods. Changing an old string to this pattern is expected; strings from `common` or `shared` stay as they are.
- **Buttons** start with a verb and name the result ("Add event", "Delete tag"); a button that opens a dialog asking for more ends in "…". Links are named for where they go.
- Say what a thing does to members in plain words, as the endpoint does it: "Members can see and start the tasks." No internal names (`publicOnly`, `staffPreview`) in the UI.
- Icons from `lucide-react`. An icon stands alone only for close, search, send, delete, settings and `InfoTip`'s info; every other control has a visible word, an overflow menu included ("More").

## The shell

`shell/ShellLayout.tsx` is the frame every signed-in page renders in: the sidebar and one scrolling `<main>`. It renders no header, breadcrumb or title; `Page` does. On staging a labelled strip sits above the frame, so size a page with `Page fill`, `flex-1` or `h-full`, never `h-screen`. The main region returns to the top when the path changes, not when only the query does.

- **`src/places.ts` is the page map in code:** `PLACES` (each with its `path`, `tabs`, `views`), `RECORDS` (each with its `place`, `path`, `tab`, `tabs`), `placeById`, `recordById`. The sidebar, the palette, `Page` and the tab hooks read it, and `routes.test.ts` fails when it and `routes.ts` disagree. What you may edit there is under **Who owns what**.
- **Your place's route already exists** in `routes.ts`, pointing at today's page or, for a place merged from several pages (Inbox, All tasks, People, Invites, Waitlist, Links, Media, the form record) and for Suites and the suite record, at a module in `src/places/`. Either way your page goes in `pages/<place>/` and you repoint the line (**Files**).
- **Queue counts:** `useQueueCounts()` (`shell/useQueueCounts.ts`) gives the four counts Home and the sidebar show, keyed by `CountId`: a number, `null` when it couldn't load, `undefined` while loading. `shell/CountBadge.tsx` renders one. `QUEUES` in `places.ts` holds each queue's label, button words, place and tab, and `queueHref(id)` its link.
- A place found by its old name in the palette comes from `oldNames` in `places.ts`; if staff knew your page by a name that isn't there, ask for it.

## Lint

`bun run typecheck` in `apps/admin` runs ESLint, which fails a file on: a raw palette colour class, an arbitrary value (a bracketed variant such as `aria-[current=true]:` is fine, a bracketed breakpoint or modifier is not), a colour literal (hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()` or `color-mix()`, or exactly `white` or `black`) in `fill`, `stroke`, `color`, `stopColor`, `floodColor`, `lightingColor` or `style`, a fixed px, rem or em length in `style`, an import of `@alliance/sharedweb/ui/*` outside `src/ui`, the shared `cn`, `ButtonColor`, and `window.confirm`, `globalThis.confirm` or a bare `confirm(`.

The files written before the redesign are listed in `apps/admin/eslint/legacy-files.txt` and skipped. When you redesign a file, delete its line, and fix what the lint then reports; `bun eslint/legacy-list.mjs` from `apps/admin` drops every line whose file now passes. Never add a line or an `eslint-disable` for these rules: a new file that needs an exception needs a token or component instead, so ask. A file you delete loses its line too, or the lint fails naming it. The redesign's PR merges only once the list is empty.

## Before you report

- Every inventory entry for your routes accounted for; every `DATACHECK.md` item on your screens substituted or dropped.
- `bun run typecheck` in `apps/admin` and `bun run test apps/admin` from the repo root pass (`cd apps/admin && bun test src/pages/<place>` while you work). Every file you redesigned or replaced is off `eslint/legacy-files.txt`.
- **Tests keep their meaning.** A moved test file goes with `git mv`. A copy change edits the string only: a load-failure test still asserts the title and the reason, a loading test asserts the loading region (`role="status"` named "Loading", which carries `invisible` for its first 200 ms) and that neither the empty nor the failed state shows, and an assertion that a failure shows twice becomes once, never none. Restore any global you replace. Tests render the page as the shell does: inside a router at the page's URL and `ToastProvider`; a page that calls `useLeaveGuard` needs a data router with `LeaveGuard` above the route (`pages/groups/GroupPage.test.tsx`). An open dialog makes the page behind it inert, so query the page only after it closes. A `Panel` or `FormSection` is a region named by its title.
- Nothing moves: select, hover, open and close each inspector, sheet and menu, and reload on a slow connection; content in view stays where it was, apart from the moves rule 9 accepts.
- You looked at the page running on your worktree's admin port, at 1440×900 and 1280×720, with real local data: loading, empty, no results, failed, a long name, a single row, and for a suite a suite of one task. Retake screenshots after your last change. Data you stubbed has the server's shape and precision, and the report says it was stubbed.
- Keyboard pass: reach and operate everything, open and close each dialog and sheet, focus returns.
- Colour pass under grayscale if the page shows any status or category by colour.
- Reload and Back on every tab, filter and open sheet return to the same thing.
- Your report has: the template you used; each inventory entry's fate; the server file behind each sentence about time, members or consequences (rule 11); any departure from this guide and why; **Guide problems** (where this guide was wrong, silent or contradicted your brief); **For the system owner** (components, tokens, routes, legacy components and anything else only they can change).

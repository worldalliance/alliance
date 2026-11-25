# Admin design guide

Read this before redesigning a place in `apps/admin`. Many agents build pages at once, each alone; this guide is what makes the pages one product. A good result: a staff member moving from your page to any other finds the same header, the same table, the same way to save, confirm and go back, and can still do everything they could on the old page.

It holds what you can't get from reading the components: which template a place uses, the rules that span pages, and the constraints of this redesign. Components are in `apps/admin/src/ui`, page templates in `apps/admin/src/ui/templates`, tokens in the second `@theme` block of `apps/admin/src/index.css`; this guide names each and you read its props in the file.

The spec is `docs/provenance/01a2113f-1284-77d9-a6e3-9a2aec087109-modern-admin-redesign/` ("the spec" below). `agents/skills/ux-guidelines/SKILL.md` applies in full and this guide doesn't repeat it; where this guide departs from the skill on purpose it says so, as for one-off values, and the guide wins; on any other disagreement, tell the system owner (see **Asking for a change**) and follow the skill meanwhile.

Reference page: Members › Groups, in `apps/admin/src/pages/groups/` (`/members/groups`, `/members/groups/:id`). Read it beside this guide and copy its shape:

- `GroupsPage.tsx`: a List place with tabs. One `Page`; the route file holds the queries both tabs need and hands each tab's body its data; a failed load of one part is a `Banner` on the tab that depends on it.
- `AllGroupsTab.tsx`: filter bar with a search in `?q=`, `ContentState` for loading, failed, no results and nothing yet, then `<Table bleed>`.
- `AwaitingTab.tsx`: a table with a control in each row, one list-wide primary action in the filter bar, and a `ConfirmDialog` that stays open, `busy`, while the write runs.
- `NewGroupDialog.tsx`: create in a dialog, then open the new record. `AddPersonDialog.tsx`: a dialog that reports a refusal inside itself.
- `GroupPage.tsx`: a Record with tabs: title from the record, facts in the description, loading, failed, not found, a danger action behind `confirm`, and a failed write as a dismissible `Banner`.
- `GroupMembersTab.tsx`: a table in a `Panel`, row actions behind `confirm`, each `busy` while it runs. `GroupSettingsTab.tsx`: an explicit-save form with `SaveBar`, `useLeaveGuard` and errors on their fields.
- `groupRules.ts`, `useGroupAssignment.ts`, `useGroupMembership.ts`: the page's rules and state, out of the markup. The `*.test.tsx` files show what a page test wraps the page in.

When this guide and the reference page disagree, the guide is right and the page has a bug to report.

## What you must keep

These bind every page. Each has a reason a reviewer will check against.

1. **Nothing staff can do today is lost.** The spec's `inventory/{tasks,forms,members,growth}.md` list every capability of every route with an ID (`PR-3`, `AD-41`, or a numbered item under a route heading). Before you design, read the entries for every route `PLACES.md` maps to your place. Your report lists each ID as carried, moved (where to) or dropped (why, and who approved). A capability with no entry in your report counts as lost.
2. **Content is today's, look is the prototype's.** A screen shows what today's page shows. The prototype (the spec's `README.md` says where it is) is a reference for look, not a spec, and its data is invented: `DATACHECK.md` lists what the server can't provide and the substitute or "drop" for each. Never render a number, column, status or chart the server doesn't give you, and never fill a gap with a placeholder value. Where the reference prototype is silent, lean to prototype C's look (calm surfaces, generous spacing), except C's home page.
3. **Reuse the data layer, write the presentation new.** Keep the page's data hooks, mutations, validation, rules in `lib/` and their tests. Write the markup new from the inventory entry and the templates: restyling the old JSX class by class is not a redesign, and it carries the old layout's defects along. The existing tests are the behaviour contract: they pass, changed only where markup changed and still asserting what they asserted. Rewriting logic is how a feature gets dropped without anyone noticing.
4. **No server change, and no change outside `apps/admin`.** Where a fix needs the server, leave today's behaviour and report it for a Linear issue in the "Modern admin" project.
5. **Guards on member-facing operations stay or get stronger.** Most of them exist only in the admin UI, so a screen you drop takes its guard with it and the server won't catch it. See **Operations that reach members**.
6. **Components come from `apps/admin/src/ui` only.** Never import `@alliance/sharedweb/ui/*` in the admin (lint). The shared form renderer, API client and hooks are still imported from where they live. Merge classes with `cn` from `ui/cn.ts`, never the shared `cn`, which drops `text-body` beside `text-fg` (lint). Buttons take `variant={ButtonVariant.X}`; `color=` is the old pages' prop (lint).
7. **Tokens only.** No raw colour classes and no arbitrary values such as `p-[13px]` (lint), and no hex or `oklch()` values in a `style` either, which the lint doesn't see. The ux-guidelines allowance for one-off values doesn't apply in the admin: ask for a token.
8. **Fix today's defects in your area** where no server change is needed; the list is in the spec's `DECISIONS.md` under "Data and defects".
9. **Nothing in view moves.** Selecting, hovering, opening an inspector, a sheet or a menu, a load finishing, a save bar or bulk bar appearing: none of them shifts content the reader is looking at (owner requirement, admin-wide). The templates do this by default: panes and side panels have fixed widths, skeletons take the content's shape, the save bar is always there, the bulk bar floats. Don't undo it: no control that appears only on hover or selection in the flow, no border that adds width when selected (use an outline or a colour change), no panel that mounts beside content and squeezes it.
10. **Member content keeps the member look.** Any container of `FormRenderer`, `DisplayOnlyBlocks`, `RenderDisplayBlock`, `OutputRenderer`, `AppMarkdownWrapper` or `ActionUpdateCard` gets the class `member-surface`, which restores the member app's type inside the admin's.

### Files

A place's files live in one folder, `apps/admin/src/pages/<place>/`, named for the place's path (`pages/groups/`), with its record's page beside it. A stranger finds a page from its URL, and deleting the folder deletes the place.

| File                                          | Holds                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `<Place>Page.tsx` (`GroupsPage.tsx`)          | The place's route: the default export `routes.ts` points at. One `Page`, its tabs, the queries more than one tab needs. |
| `<Record>Page.tsx` (`GroupPage.tsx`)          | The record's route, the same way.                                                                                       |
| `<Name>Tab.tsx`                               | One tab's body, a named export. A page without tabs has its body in the page file.                                      |
| `<Verb><Thing>Dialog.tsx`, `<Thing>Sheet.tsx` | One dialog or sheet. A plain `confirm()` needs no file.                                                                 |
| `<thing>Rules.ts`, `use<Thing>.ts`            | Rules and state the markup reads, so they can be tested and read without it.                                            |
| `<File>.test.tsx`                             | Beside the file it tests. An old page's test moves here and is edited, not rewritten, where it still fits.              |

Data hooks shared with other places stay in `src/lib`. When every file of an old page is replaced, delete the old files (`pages/<Old>Page.tsx` and the files under `src/components/` only it used) in the same commit, and point `routes.ts` at the new route files. A component two places need goes to the system owner, not into one place's folder.

### Asking for a change

You own your area's page folders. Tokens, `src/ui`, the shell (`src/shell`, `routes.ts`, `places.ts`, `legacyRoutes.ts`) and this guide have one system owner, with two edits that are yours: pointing your own places' and records' lines in `routes.ts` at your new route files, and listing your own records' tabs in `RECORDS` in `places.ts`. If a page needs a component, variant, token or template this guide lacks, don't build a local one, since ten local variants are ten products: put the ask in your report under "For the system owner", tell your lead, and meanwhile compose the nearest existing pieces. If the guide is wrong, say so the same way rather than working around it: the fix goes in the guide, so every page gets it.

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

| Template      | Pieces                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page    | `Page` (`Page.tsx`): document title, breadcrumb, header, tabs, banner, body. `usePlaceTabs`, `usePlaceViews`, `useRecordTabs` (`usePlaceTabs.ts`), `Banner` (`Banner.tsx`), `ContentState`, `ErrorState`, `TableSkeleton` (`States.tsx`).   |
| List          | `Page fill`, then `FilterBar` with `SearchField`, filters, `FilterChip`; `ListContent`; `ListFooter`; `ViewSwitch`; `BulkBar` (all `List.tsx`). Table from `ui/Table.tsx` with `bleed`.                                                     |
| Record        | `RecordBody` with `SidePanelSection`, `FactList`, `Fact` (`Record.tsx`), or `PageBody` when there is no side panel.                                                                                                                         |
| Overview      | `PageBody`, `Section`, `OverviewGrid`, `Panel`, `StatTile` (`Overview.tsx`).                                                                                                                                                                |
| Workspace     | `Page fill`, then `Workspace`, `WorkspaceToolbar`, `PaneHeader` (`Workspace.tsx`).                                                                                                                                                          |
| Settings form | `PageBody width="form"`, `FormSection`, `Field`, `CheckboxField`, `SaveBar`, `useFocusFirstInvalid` (`Form.tsx`).                                                                                                                           |
| Dialog        | `ui/Modal.tsx`: a `<form>` holding `ModalHeader` with `ModalTitle`, `ModalBody`, then `ModalFooter` with `ModalActions` (Cancel, then the primary submit). A confirmation is `confirm()` or `ui/ConfirmDialog.tsx` (see **Confirmations**). |
| Sheet         | `ui/Sheet.tsx`, `size="peek"` for a look at one row, `"wide"` for a form or table.                                                                                                                                                          |

### The page file

A route's component returns one `Page`. This is a List place with tabs, the reference page cut down; the other templates change only what is inside `Page`.

```tsx
const TABS = ["all", "awaiting"] as const;
type Tab = (typeof TABS)[number];

export default function GroupsPage() {
  const tabs = usePlaceTabs(PlaceId.Groups, TABS);
  const groups = useCommunitiesAdmin(); // today's hook, unchanged
  const [creating, setCreating] = useState(false);
  const body: Record<Tab, () => ReactNode> = {
    all: () => <AllGroupsTab groups={groups} />,
    awaiting: () => <AwaitingTab groups={groups} />,
  };
  return (
    <Page
      fill
      place={PlaceId.Groups}
      actions={
        <Button
          // One primary per view: Awaiting assignment has its own.
          variant={
            tabs.value === "all" ? ButtonVariant.Primary : ButtonVariant.Default
          }
          onClick={() => setCreating(true)}
        >
          New group…
        </Button>
      }
      tabs={tabs}
    >
      {body[tabs.value]()}
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </Page>
  );
}
```

A tab's body, or the body of a page without tabs, is the filter bar and the content in its states (`q`, `setQ` and `rows` are the `?q=` search and the filtered list; `AllGroupsTab.tsx` has them whole):

```tsx
export function AllGroupsTab({
  groups,
}: {
  groups: UseQueryResult<CommunityDto[]>;
}) {
  // …
  return (
    <>
      <FilterBar count={countOf(rows.length, "group")}>
        <SearchField label="Filter groups" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={groups.isPending}
          skeleton={<TableSkeleton bleed columns={4} />}
          error={
            groups.isLoadingError
              ? adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load groups"
          onRetry={() => void groups.refetch()}
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

- **`place`** is the `PlaceId` (`src/places.ts`) the page is. From it `Page` sets the document title, the breadcrumb and the one `h1`; don't write a `<title>`, a trail or a header by hand. A record's page passes `record={RecordId.Suite}` in its place, with `title={suite?.name}` (until the name loads `Page` shows the record's kind, "Suite", from `places.ts`), and `parents={[{ label, to }]}` when it sits under another record, as a project's task does. `badge`, `description` and `actions` fill the rest of the header. A record whose `description` comes with its data passes `""` until it loads: the line is held, so the tabs don't drop when it arrives.
- **Tabs and views** come from `places.ts`, which the redirects, the palette and the sidebar also read. `usePlaceTabs(place, ids)` binds a place's tabs to `?tab=`, `usePlaceViews(place, ids)` its views to `?view=`, `useRecordTabs(RecordId.Suite, ids)` a record's tabs. `ids` repeats the ids from `places.ts` (`const TABS = ["all", "awaiting"] as const`), so `tabs.value` is a typed union to `switch` on or to index a `Record<Tab, …>` with, and the hook throws if they differ. Pass the result as `tabs={tabs}`; with `tabs`, the children are the current tab's body. Only the current tab's body is mounted, so state both tabs need (a selection one tab makes and the other shows) lives in the page file or the URL, and an unsaved form on a tab is lost on leaving it unless `useLeaveGuard` asks first. To show a count on a tab, map `tabs.items` and add `count`.
- **`fill`** makes the page take the frame's height so only its body scrolls: always on List and Workspace, never on the others, which scroll with the frame.
- The body brings its own padding: `ListContent` and `Workspace` run edge to edge; `PageBody` and `RecordBody` pad and space their children. Don't add page margins yourself.

### List

Anatomy, top to bottom:

1. **Page header.** The place's name as the page's one `h1`, an optional one-line description under it in muted text, and on the right at most one primary action plus secondary actions. The primary action creates the thing listed ("New suite").
2. **Tabs**, when the place has them in `PLACES.md` (People: All, Staff, Away). A count sits beside a tab label only where today's page has that count.
3. **Filter bar** (`FilterBar`). Search field first, then filters, then on the right the result count and list-wide actions such as export. Every tab of a place renders one, even with nothing to filter, and its controls are the small size (`size="small"`, `h-control-sm`), so the list starts at the same height on every tab. An applied filter shows as a chip naming field and value with a remove control, so the reader sees why rows are missing. Offer only the filters and sorts today's page has; the server pages and filters some lists and not others, and the data hook decides. The one addition allowed everywhere: a search by name over a list the hook already loads whole.
4. **Body** (`ListContent`, the only part that scrolls). A table, edge to edge with no card around it (`<Table bleed>`), when rows share columns that staff compare. A stack of cards (`<ListContent cards>`) when each item is several lines of prose or holds its own controls (tags, organizations, partnership responses, the projects board). Grouped rows get a group heading row (suite name and count), not separate tables.
5. **Footer** (`ListFooter`): pagination, only where the data hook paginates.

A list that offers views of the same items (Tasks: Timeline, List, Priority; People: Table, Map) puts `<ViewSwitch label="View" {...usePlaceViews(place, ids)} />` in the header's actions for a two-way switch, or passes the views as `Page`'s `tabs` when there are three or more and the place has no tabs of its own, and keeps the filter bar across views.

### Record

1. **Record header** (`Page`'s `title`, `badge`, `description`, `actions`). Title as `h1`; the status badge directly after it; one muted line of facts under it (kind, parent links, the one or two numbers that matter). On the right: at most one primary action, secondary actions, and a "More" menu for the rest; a record whose only header action is its delete shows it as a `DangerOutline` button rather than a menu of one. The breadcrumb `Page` renders above the title carries the way back; don't add a back link.
2. **Tabs**, from `PLACES.md`, in that order. The first tab is the one staff most often want on arrival, not an empty summary.
3. **Body** (`RecordBody`): a main column, plus a **side panel** on the right (its `side` prop; 320 px, moving above the main column in a narrow frame) when the record has a handful of standing facts worth seeing on every tab's first screen (status, dates, parent links, audience). The side panel is a label and value list (`FactList`, `Fact`). A value there is editable in place only if today's control for it already saves at once; otherwise it links to the tab that edits it. No side panel when a tab needs the full width (a builder, a wide table, the launch page) or the record has fewer than about four such facts.
4. A **standing banner** (`Page`'s `banner`, a `Banner`) above the body for a fact that changes what every action on the page means: "Nothing is visible to members until you launch" on a draft suite, "Not visible to members" on a draft task. Not for tips.

A record with one screen of content has no tabs. One whose sections are different jobs, or run long enough to push each other off the first screen, gets a tab per job (a group: Members, Progress, Settings), added to its `tabs` in `RECORDS`. While the record loads, fails or isn't found, the header and tabs stay and `ContentState` fills the body: "not found" is its empty state, with a button to the place's list. A record that is mostly one form (contract, formula, general update, member list) is still a Record: it has identity, a status or usage, and delete; its body follows **Forms**.

### Overview

A page header, then sections in one column (`Section`), each a heading and a card or a row of cards on a 12-column grid (`OverviewGrid`; children take `col-span-*`). A card with a title row is a `Panel` (`flush` around a table), a number is a `StatTile`. Order sections by what needs action first, then what informs. A section links to the List that holds its full data ("All tasks"). Stat tiles show a label, a number and nothing the server doesn't provide: no deltas or sparklines unless today's page computes them. Home's content is fixed by `REQUIREMENTS.md`: the four queues in order, each only when above zero, then the stats; "Nothing needs you right now" as one line when all are zero.

### Workspace

`Workspace` fills the frame under the page header (`Page fill`); the page itself never scrolls, each pane does. Up to three panes: **navigator** (left, 288 px: outline, thread list), **canvas** (center, the children: the thing being worked on), **inspector** (right, 320 px: properties of the selection, or context). A `WorkspaceToolbar` across the top holds mode switches, undo and redo, the save state and the primary action. When a workspace is a tab of a Record, the record header stays above it.

Rules that make a workspace calm, each from an owner complaint or a WCAG criterion:

- **Selecting never moves the page.** Selecting an item in any pane changes the inspector's content and the selection highlight, and nothing else: no pane resizes, nothing scrolls unless the selected item is off-screen. Always pass `inspector`, and when nothing is selected have it say what to select, so the pane keeps its place. The owner named this defect in today's form builder.
- Panes keep the template's widths; a pane may collapse only by a labelled control.
- Reordering by drag also works without dragging (move up, move down, or a menu), per WCAG 2.5.7.
- The canvas of the form builder renders the member-facing form renderer and must look as it does in the member app. Don't restyle what's inside it; admin chrome (selection outline, handles, add buttons) sits around it.
- Adding an element opens a searchable picker listing only field and block types that exist today (`DATACHECK.md` names eight the prototype invented).

The form builder is the three-pane case: outline, canvas, inspector. Three panes is the owner's firm pick; the rest of the prototype's builder is mood only (the owner dislikes things in it, such as its unnamed controls). Design the builder from today's builder and `inventory/forms.md`, keep every capability there, and where a detail is your call, say so in your report so it gets a look. Forms have no draft or publish step: the prototype's "Publish changes", "Published" badge and version numbers don't exist. The toolbar shows today's save control and state, and on a launched task says that a save is live for members on their next load.

### Settings form

A page header, then one column (`PageBody width="form"`) of `FormSection`s, each a heading, optional one-line description, and its fields, with one save control (its `footer`, usually a `SaveBar`) per independently saved form. A page holding several unrelated small tools (Settings › Developer tools) gives each its own section and button.

### Dialog and Sheet

|            | Use it for                                                                                                                                                                  | Not for                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Dialog** | A decision, a confirmation, or creating something from up to about four fields (New suite: a name). Blocks the page.                                                        | Anything needing a look at the page behind it; anything with tabs; long forms.   |
| **Sheet**  | Looking at or lightly editing one item from a list while the list stays in view: a member from People, a forum post, a task update from Messages. Slides in from the right. | Records staff work in for long. Those get a page; the sheet offers "Open" to it. |
| **Page**   | Everything else. A flow with consequences for members (suite launch) is a page, so it has a URL, survives a reload and has room for its checks.                             |                                                                                  |

A dialog's form follows **Forms**. While its write runs, the submit button is `busy` and the dialog can't be dismissed (`dismissDisabled`); a refusal shows in the footer above the buttons, as an alert, and the dialog stays open with what was typed. Mount the dialog only while it is open (`{creating && <NewGroupDialog … />}`), so each opening starts clean. Keep the title short: the page behind it already names the record.

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
| Content  | General updates       | List          |                                                                                                                                                             |
| Content  | Forum posts           | List          | A post opens in a Sheet.                                                                                                                                    |
| Content  | Media                 | List          | Tabs Image upload (Settings form body: an upload, no library), Videos.                                                                                      |
| Activity | Event log             | List          | New rows stream in at the top; announce them without moving focus.                                                                                          |
| Activity | Scheduled jobs        | List          | Rows expand to their members.                                                                                                                               |
| Research | Kora participants     | List          | Tabs Participants, Assignments, not in `places.ts` yet: ask the system owner first. Project status and batch controls in sections above, as today.          |
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
| Group, Member list, Formula, Contract, General update, Video, Kora assignment | Record                                        | No tabs unless today's page has sections worth them.                                                                                                                                                                  |
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
- Spacing between things comes from the template and from stack and grid gaps, on the token scale. If you're adding a margin to make something line up, the structure is wrong.
- Left edges line up: page title, tabs, filter bar and the first table column share the page margin.
- The owner chose this density because the tighter one read as cluttered. Don't add secondary labels, hint footers, inline shortcut keys or decorative counts to fill space; the prototype hides those in Comfortable.
- Design for 1280×720 up to wide screens: a table may scroll sideways inside its container, the page never does.

## Typography

One sans family (Inter, set on everything), one mono (`font-mono`). Roles, not sizes. `Page`, `Section` and `StatTile` set the page title, section label and stat number.

| Role                  | Class                                                              | Use                                                                     |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Section or card title | `text-heading font-semibold` (16/24), or body size `font-semibold` | `h2`, `h3` in order; never skip a level for looks.                      |
| Body                  | `text-body` (13.5/21), the default                                 | Everything unless a row here says otherwise.                            |
| Small                 | `text-caption font-medium` (12.5/16)                               | Table headers, metadata, badges, help text.                             |
| Reading text          | `text-base/6 max-w-prose` (16/24)                                  | Prose staff read at length: an update's body, a contract, a transcript. |
| Mono                  | `font-mono text-xs`                                                | Ids, variables, code, JSON. Not for numbers in tables.                  |

Emphasis is weight (medium, semibold), never a second colour. Muted text is for what the eye may skip, and it still meets 4.5:1. Numbers that line up in a column use tabular figures.

## Surfaces and colour

Four layers, and hierarchy comes from borders and the layer change, not shadows.

| Layer               | Classes                         | Use                                                                                                 |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Page background** | `bg-canvas`                     | The page, the sidebar, a Record's side panel, a Workspace's navigator and inspector.                |
| **Raised surface**  | `bg-surface border border-line` | Cards, tables, the Workspace canvas items, inputs (`border-line-control`). One border, no shadow.   |
| **Sunken surface**  | `bg-surface-2`                  | Table header row, row hover, a group heading row, read-only wells.                                  |
| **Floating**        | `bg-surface shadow-pop`         | Menus, popovers, sheets, dialogs, the palette, the bulk bar, toasts. The only things with a shadow. |

Text is `text-fg` or `text-fg-muted`; dividers `border-line`, stronger edges `border-line-strong`. Each of `accent`, `success`, `warning`, `danger` and `info` has a `-soft` background (`bg-danger-soft text-danger`). `ui/tokens.test.ts` checks the contrast of the pairs in use: add a pair there when you pair two tokens it doesn't list.

- A card groups content that belongs together and could be moved as a unit. Don't put a card in a card; use a divider or a sunken row inside.
- On a List the table is the page: no card. On a Record or Overview a table sits in a card with a card header.
- **Accent** marks the primary action, the current selection, links and focus. One primary button per view.
- **Success, warning, danger and info** mean only that. Never use them for a category, a project, emphasis or an unread mark.
- **Category colours** (projects) are the tokens `cat-1` to `cat-6`, each with a `-soft` background. The server stores no colour, so pick one from the project's id (`hashString` in `lib/identitySwatch.ts`), and always show it beside the project's name.
- A `Banner` takes `BannerTone.Info` for a standing fact, `Warning` for a consequence to weigh, `Danger` for a violation or blocker; it starts with an icon and says the thing in words. `inline` puts it in the body as a box.
- Light theme only. Every colour is a semantic token so a dark theme is a second set of values; a raw colour would break it.

## Status badges

A status is always a badge with a word (`ui/Badge.tsx` with a `BadgeTone`). Never a dot, a coloured row, a coloured number or an icon alone (owner requirement, and WCAG use of colour); where there is no room for the word, drop the status from that spot. The same status has the same word and tone on every page: a task's or suite's phase is `<PhaseBadge status>` (`ui/PhaseBadge.tsx`; `phaseLabel` for the word alone). Don't restyle it, and don't use `ACTION_STATUS_LABELS` or `ACTION_STATUS_COLORS` in redesigned pages.

Phase order everywhere (columns, legends, strips): Draft, Planned, Members taking action, Office taking action, Resolution, Completed, Failed, Abandoned. A status the data holds is shown, though no control sets it. A suite's badge is the phase of its two shared events; its tasks may be further along.

For other statuses pick the tone by meaning: neutral for inactive or not started, success for done or healthy, warning for needs attention soon, danger for failed or blocked, info for in progress or scheduled. Neutral badges are outlined so they read as badges, not text. Two statuses that share a tone must still differ by their word. A count that asks for attention (queue counts) is a count badge, not a status.

## Tables

`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `ui/Table.tsx`: row and header heights, the sticky header, hover and the selected tint (`aria-selected` on the row) are built in. `bleed` on a List; none inside a `Panel flush`.

- **First column** is the thing's name, medium weight, and is a real link to its record or sheet (`className={nameLinkClass}` from `ui/styles.ts`), so open-in-new-tab and copy-link work. A row click may also open it, but the link is the accessible route. Any other link in a cell or a sentence takes `linkClass`, which underlines it.
- **Alignment**: text and dates left; numbers right, with their header right too (`text-right tabular-nums`); a status badge left. Never center.
- **Numeric columns** show the unit in the header, not in every cell ("Time (min)"). A value the server doesn't have is "—", never 0.
- One line per row, a row with a control in it included: a message about the row's control goes in the cell beside it, not under it, so it appearing doesn't grow the row. Long text truncates with the full value in a tooltip or the record. Cap a text column near 260 px rather than let it push others off screen. A row that needs two lines of content is a card, not a tall row.
- **Header** is sticky, sentence case, and a sortable header is a button that shows its direction and sets `aria-sort`. Sort only by what today's page or the data hook sorts by.
- **Row actions**: the action staff take most on a row is a small labelled button at the row's end; the rest go in a "More" menu, though two short actions may both show. Every row's button reads the same, so give each an `aria-label` that starts with the visible label and names the row ("Remove: Sam Lee"). The header cell over the actions holds a visually hidden name. Which icons may stand alone is under **Copy**. Row actions are visible at rest, not only on hover, since hover-only controls are invisible to keyboard and touch.
- **Selection** exists only where today's page has an action on several rows. Checkbox column first; the header checkbox selects the loaded rows and says how many. Selected rows get the selected tint plus the checked box. `BulkBar`, the last child of the page's body, floats at the foot of the main region, says "N selected", lists the actions with words, and Escape clears the selection.
- **Expandable rows** (scheduled jobs, event data) expand in place under the row with a labelled or `aria-expanded` control.
- **Pagination** (`ui/Pagination.tsx` in a `ListFooter`) follows the data hook: numbered pages where the server pages, none where the list loads whole. Don't add infinite scroll.

## Forms

`Field` (`templates/Form.tsx`) lays out the label, help and error and hands its child the `id` and ARIA props; controls are `Input`, `Textarea`, `Select`, `Switch`, `UserSelect` and `DateTimePicker` from `ui/`. A checkbox with its label and explanation is `CheckboxField`. `UserSelect` brings its own label (`label=`), so it doesn't go inside a `Field`. A form whose fields serve both a create dialog and a record's settings is one fields component used by both (`GroupSettingsFields.tsx`). `FormInput` and `LargeCheckbox` are the old pages' and stay with them.

- **Label above its control**, sentence case, no colon. Help text sits under the label or control in small muted text and stays visible when an error shows. A placeholder is an example at most, never the label or a needed instruction.
- Mark the minority with `Field`'s `mark`: where most fields are required, mark the optional ones "(optional)"; where most are optional, mark the required ones "(required)". No bare asterisk.
- One column. Two fields share a row only when they are one thought (start and end).
- **Errors** appear under the field when the reader leaves it or submits, say how to fix it, and clear once fixed. A failed submit keeps every value, focuses the first bad field (`useFocusFirstInvalid()` gives the form's `ref` and a function the submit handler calls beside setting its errors), and a form with more than a few fields leads with a summary linking to each. Put `noValidate` on the `<form>` so the browser's bubbles don't answer first.
- **A field that only sometimes applies stays rendered**, disabled, with its help saying why it isn't used, so ticking the box that governs it moves nothing.
- **The submit button stays enabled** and reports what's wrong when pressed, unless today's page disables it as a guard (Launch while blockers remain): then the reason is visible text beside it.
- **A button whose write is running takes `busy`** (`ui/Button.tsx`): it keeps its label and focus, shows a spinner and ignores presses, submits included. That is the admin's pending button; the ux-guidelines' hand-styled `aria-disabled` is for the old pages' buttons.
- A switch takes effect at once; a setting saved by a Save button is a checkbox.
- Dates and times use `ui/DateTimePicker.tsx`, name their timezone in the label ("Pacific time") and never default to now for anything that creates an event.

### Saving

Keep each page's save model as it is today; the model is part of the data layer you reuse, and on a launched task a save reaches members.

| Model                  | Where                                                                           | What the page shows                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Explicit save**      | Most forms: task details, contract, general update, formula, the form builder.  | A `SaveBar` at the foot of the form, always rendered: primary "Save changes", "Discard", and its `SaveState` (unsaved changes, saving, saved, failed with the reason). |
| **Immediate**          | A control that today writes on change: a switch, the project picker, a tag add. | The control itself shows pending and failure; failure puts the old value back and says why.                                                                            |
| **Create in a dialog** | New suite, New group.                                                           | A "Create suite" button; on success a toast and go to the new record.                                                                                                  |

- Don't turn an explicit save into autosave. An update's first content save publishes it, and a form save on a launched task is live for members on their next load, so an autosave would publish half-written text.
- **Unsaved changes**: every explicit-save form calls `useLeaveGuard` from `lib/useLeaveGuard.ts` with its dirty state. It asks before navigation and reload; pass `allowSamePath` when the unsaved state survives a tab or filter change on the same path. After a save that navigates, use the function it returns so the guard doesn't ask about what was just saved.
- Before saving, the content check in `components/useContentConfirm.tsx` still runs wherever it runs today.
- A save that reaches members at once says so before saving, beside the save button (`SaveBar`'s `note`): a launched task's details, form or variant; an update's first content save; a reminder group.

## Empty, loading, error

- **Loading.** The first load of a page or tab shows a skeleton shaped like the content (rows for a table, tiles for tiles), after a delay of about 200 ms so fast loads don't flash, with the header, tabs and filter bar already in place so nothing jumps when data lands. A refetch keeps the current content on screen. A button that is working keeps its label, shows a spinner, and ignores presses: pass `busy` to `Button`, which also keeps its focus; don't swap the label for "Saving…" or disable it. `ContentState` does the delay and the choice of state for any region that loads; give it a `skeleton` built from `TableSkeleton` or `ui/Skeleton.tsx` blocks sized like the content. For anything else, `useDelayedFlag` (`templates/useDelayedFlag.ts`) is the delay.
- **Nothing yet** (`ContentState`'s `emptyTitle`, or `ui/EmptyState.tsx`): names what is empty and offers the next step where there is one ("No suites yet", "New suite"). On Home and queues, an empty queue is good news and says so in one line.
- **No results**: filters or search matched nothing. Says so and offers "Clear filters". Never the same text as nothing yet.
- **Failed to load** (`ErrorState`): says what couldn't load, shows the server's reason (`adminRefusalMessage(error, LOAD_FAILED_FALLBACK)`, the fallback being for a failure with no reason), offers "Try again". Use the query's `isLoadingError`, so a failed refetch keeps the content it already has. Inline where the content would be, and it stays until resolved. When part of a page fails, the rest still renders and a banner names the failed part and what that means for what's shown, as `components/FailedLoadsBanner.tsx` does today. A failed load never looks like an empty list.
- **A write that failed** says so where the reader is looking and stays until dismissed or the next success: an explicit save in its `SaveBar`; a write from a dialog's form in the dialog's footer; a write confirmed in a `ConfirmDialog`, which closes once the write settles, beside the control that opened it (the filter bar for a filter-bar action, as `AwaitingTab.tsx` does); a write from a row or a header button as `Page`'s `banner`, a `Banner` with `BannerTone.Danger` and a "Dismiss" button. A toast may accompany each (`lib/useRefusalToast.ts`).
- **Refused by the server**: show the server's own message through `lib/adminRefusal.ts`, as today. An expired session shows the session message from `lib/sessionExpired.ts`.
- **Permissions**: every signed-in admin can do everything; there are no roles to gate on. Don't add permission states, and don't hide or disable a control because an action is risky: admins may do almost anything given a warning that says what it breaks (ux-guidelines). A new block needs its own reason recorded in the spec's `DECISIONS.md`.
- A malformed thing fails loudly: a form whose schema has an error doesn't render a fillable preview.

## Confirmations

Three levels. Pick by what the action reaches, not by how nervous it feels; a confirmation on a routine action teaches staff to click through the ones that matter.

| Level               | When                                                                                                                          | Form                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **None, with undo** | Reversible, reaches no member, and a reverse mutation exists today.                                                           | Not built yet: the toast has no Undo (see **Toasts**).                                                                                                                                                                                                                                                                                      |
| **Confirm**         | Irreversible or hard to reverse, staff-side: delete a tag, remove a group member or leader, archive a task, delete a variant. | Dialog. Title names the action and the thing ("Delete the tag "captain"?"). Body says what is lost or who is affected. Buttons: "Cancel" and a verb ("Delete tag"), danger-styled when destructive. The destructive button is never the default: no Enter, no initial focus. `confirm({ title, message, confirmLabel, destructive: true })` |
| **Typed phrase**    | Notifies or exposes real members.                                                                                             | Full dialog stating who is reached and that it can't be undone, then a field that must match the phrase exactly. `confirm({ …, requiredText })`                                                                                                                                                                                             |

`confirm` comes from `useConfirmOnPage()` (`lib/useConfirmOnPage.ts`) and resolves to `true` or `false`; it closes, declined, when the path changes, so a question left open doesn't act on a different record. It opens the admin's dialog, `ui/ConfirmDialog.tsx`; render that component yourself only when the dialog must stay open, `busy`, while the work runs, as a batch that can half-apply does. Its `message` is text; lines break at `\n`. When the confirmed write runs after the dialog closes, the button that opened it shows `busy`. Replace every `window.confirm` with the Confirm level (lint), keeping its wording's facts. `components/ConfirmDialog.tsx` is the old pages' wrapper.

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
- **Creating and launching stay separate.** New task and New suite create a draft and nothing else. Tasks launch through their suite's Launch tab; adding an event to a task outside a suite is a deliberate path behind its typed phrase, not an everyday button.
- **An update is not sent by a countdown.** Typed phrase, not "Sending in 10 s, Cancel".
- **Reminders, follow-up forms and updates stay three things**, each with its own screen and confirmation, even where one tab lists them together.
- **Variants keep stage-then-publish**, the over-100% block and the delete confirmation.
- Paste JSON keeps events off by default. Duplicate and Paste say what they copy.
- Visibility mode and public-only are two settings; name them so neither is mistaken for the other, and say what each exposes.
- "Preview as member" is not staff preview: turning staff preview on shows the draft to every staff account.

If your design moves or merges one of these screens, your report says where each guard now lives.

## Toasts

`useToast()` from `ui/ToastProvider.tsx` gives `success`, `error`, `info`, `warning` and `showToast`. The provider is mounted once at the root and shared with the form renderer; don't mount another. Toasts keep the shared look for now.

- A toast confirms something the reader just did and could afford to miss: "Suite created", "Copied link".
- Never the only place for a failure, a warning, or anything needing action: those go inline or in a banner and stay. A failed save shows at the save control; a toast may accompany it.
- One short sentence, past tense, naming the thing. No "Successfully".
- The toast has no action button yet, so there is no Undo toast: until the system owner adds one, use Confirm where a mistake would cost work.

## Keyboard

- The shell owns `⌘K` (palette), `[` (sidebar), `?` (shortcut list) and `g` then `h`, `i`, `t`, `m`, `w`, `c`, `a`, `r` or `s` (go to an area). Don't bind these or anything that shadows a browser or OS shortcut.
- A page may use without registering: Escape to close the top layer then clear selection, `⌘Enter` to submit from a text area, arrow keys inside a composite widget (list, grid, tabs) with one tab stop for the whole widget. `SearchField` registers `/` itself.
- Any other shortcut is `useShortcut({ keys: "e", label: "Edit task", run })` from `shell/shortcuts.tsx`, registered while the component is mounted: `keys` is space-separated for a sequence (`"g t"`) and `"mod+s"` for ⌘ or Ctrl. It is then listed under "This page" in the `?` list. A single key or a sequence is ignored while the reader types or a dialog is open, and is under the shell's off switch (WCAG 2.1.4); a `mod+` shortcut runs anywhere, so guard its `run` where it must not act behind an open dialog. Two shortcuts throw when they share keys or one's keys start the other's sequence (`g` beside `g t`). Show the keys in the control's tooltip with `ui/Kbd.tsx`.
- Everything works by keyboard alone, in reading order, with visible focus. A dialog and a sheet trap Tab, close on Escape and return focus to what opened them.

## URL state

The URL holds what a colleague needs to see the same thing from a pasted link, and what Back should return to.

| State                                               | Where                                                                                                    | History                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Record, and the tab of a record or place            | Path for the record; `?tab=` through `usePlaceTabs` or `useRecordTabs`, the first tab being the bare URL | Push                                                           |
| View of a list (timeline, list, priority)           | `?view=` through `usePlaceViews`, the first view being the bare URL                                      | Push                                                           |
| Open sheet                                          | The record's route where one exists (`/content/posts/:postId`), else a search param naming the id        | Push, so Back closes it                                        |
| Search text, filters, sort, page                    | Search params named for the field (`q`, `status`, `sort`, `page`)                                        | Replace, so Back leaves the list instead of undoing keystrokes |
| Selection, expanded rows, scroll, a half-typed form | Not in the URL                                                                                           |                                                                |

- Defaults stay out of the URL, and an unknown value falls back to the default without an error.
- Bind `SearchField` straight to the search param: it keeps its own text while the URL catches up, so fast typing loses nothing. Any other text input bound to the URL needs the same care.
- Changing a filter resets `page`. Changing a tab through the hooks drops every param but `view`, since a tab's filters, page and open item mean nothing on its sibling; changing a view keeps them all.
- A place's tabs share one URL, so write a search param from the current ones (`setSearchParams((prev) => …)`, or a hidden input per kept param in a GET `<Form>`): replacing the whole query drops `tab` and `view` and lands on the first tab. Link to a tab with `tabHref(placeById(PlaceId.Groups), { tab: "awaiting" })`, and to a record with `href()`. `lib/useSearchParamTab.ts` is the old pages': it writes the first tab's id into the URL.
- Old URLs already redirect, query and hash kept (`legacyRoutes.ts`, tested by `routes.test.ts`); link to the new URLs.
- Launch progress stays in local storage as today, so a reload keeps it.

## Copy

- **Sentence case** everywhere: titles, tabs, buttons, table headers, menu items. "New suite", not "New Suite".
- **"Task", never "action"**, in everything staff read: "Task updates", "Suite" (not "Action suite"), "Scheduled jobs" (not "Scheduled plans"). Three exceptions. The phase names stay "Members taking action" and "Office taking action", since "member task" would mean something else. Code, routes' internals, API fields and types keep `action`. The typed phrases keep their exact words.
- **US spelling**: organization, canceled, color.
- **Dates** in `en-US` through `formatDate`, `formatTime` and `formatDateTime` from `lib/formatDate.ts`: "Nov 30", with the year only when it isn't this year, the weekday where the day of the week matters ("Tue, Nov 24"), time as "7:00 PM". A deadline, event or scheduled job passes `timeZone` (`LAUNCH_TIME_ZONE`), which names the zone ("PT"). A relative time ("2m ago") is for recent past activity only and carries the absolute time in its tooltip.
- **Numbers** get thousands separators (2,911) through `formatCount` from `lib/formatNumber.ts`, except inside a typed phrase. A count with its noun is `countOf(n, "member")` from the same file ("2,911 members"), not `withCount`, which leaves the separators out. A missing value is "—".
- **Buttons** start with a verb and name the result ("Add event", "Delete tag"); a button that opens a dialog asking for more ends in "…". Links are named for where they go.
- Say what a thing does to members in plain words where it does something to members: "Members can see and start the tasks." No internal names (`publicOnly`, `staffPreview`) in the UI.
- Icons from `lucide-react`. An icon stands alone only for close, search, send, delete and settings; every other control has a visible word, an overflow menu included ("More").

## The shell

`shell/ShellLayout.tsx` is the frame every signed-in page renders in: the sidebar and one scrolling `<main>`. It renders no header, breadcrumb or title; `Page` does. On staging a labelled strip sits above the frame, so size a page with `Page fill`, `flex-1` or `h-full`, never `h-screen`. The main region returns to the top when the path changes, not when only the query does.

- **`src/places.ts` is the page map in code:** `PLACES` (each with its `path`, `tabs`, `views`), `RECORDS` (each with its `place`, `path`, `tabs`), `placeById`, `recordById`. The sidebar, the palette, `Page` and the tab hooks read it, and `routes.test.ts` fails when it and `routes.ts` disagree.
- **Your place's route already exists** in `routes.ts`, pointing at today's page or, for a place merged from several pages (Inbox, All tasks, People, Invites, Waitlist, Links, Media, the form record), at a module in `src/places/` that picks the old page from the URL under a plain row of links (`shell/TabbedPlace.tsx`). Suites and the suite record are modules there too: Suites is a stopgap list for a place that had no page, and the suite record shows the old launch page on `?tab=launch` and the old suite page otherwise, with no row of links. To redesign any of these, replace that module's content with your page, keeping its file name and default export, and delete what it no longer uses. For any other place, point its line in `routes.ts` at your new file if you don't reuse the old one's name; that edit is yours.
- **A new route, place, tab or view, or a change to an id or path, goes through the system owner:** redirects and palette entries point at them. The one part of `places.ts` you edit yourself is the `tabs` of a record in your area whose ids nothing links to yet (the task, suite and project tabs come from `PLACES.md` and are unsettled); the suite's `launch` and the form's `responses` and `versions` are fixed.
- **Queue counts:** `useQueueCounts()` (`shell/useQueueCounts.ts`) gives the four counts Home and the sidebar show, keyed by `CountId`: a number, `null` when it couldn't load, `undefined` while loading. `shell/CountBadge.tsx` renders one.
- A place found by its old name in the palette comes from `oldNames` in `places.ts`; if staff knew your page by a name that isn't there, ask for it.

## Lint

`bun run typecheck` in `apps/admin` runs ESLint, which fails a file on: a raw palette colour class (`bg-gray-100`, `text-red-600`, `bg-white`), an arbitrary value (`p-[13px]`, `text-[#333]`, `grid-cols-[1fr_20rem]`; a bracketed variant such as `aria-[current=true]:` is fine, a bracketed breakpoint or modifier such as `max-[600px]:` or `text-sm/[17px]` is not), an import of `@alliance/sharedweb/ui/*` outside `src/ui`, the shared `cn`, `ButtonColor`, and `window.confirm`, `globalThis.confirm` or a bare `confirm(`.

The files written before the redesign are listed in `apps/admin/eslint/legacy-files.txt` and skipped. When you redesign a file, delete its line, and fix what the lint then reports; `bun eslint/legacy-list.mjs` from `apps/admin` drops every line whose file now passes. Never add a line or an `eslint-disable` for these rules: a new file that needs an exception needs a token or component instead, so ask. A file you delete loses its line too, or the lint fails naming it. The redesign's PR merges only once the list is empty.

## Before you report

- Every inventory ID for your routes accounted for; every `DATACHECK.md` item on your screens substituted or dropped.
- `bun run typecheck` in `apps/admin`, which also runs the lint (tokens, imports, file size), and `bun run test apps/admin` from the repo root pass. Every file you redesigned or replaced is off `eslint/legacy-files.txt`.
- Nothing moves: select, hover, open and close each inspector, sheet and menu, and reload on a slow connection; content in view stays where it was.
- You looked at the page running on this worktree's admin port, at 1440×900 and 1280×720, with real local data: loading, empty, no results, failed, a long name, a single row, and for a suite a suite of one task (most launched suites hold one).
- Keyboard pass: reach and operate everything, open and close each dialog and sheet, focus returns.
- Colour pass under grayscale if the page shows any status or category by colour.
- Reload and Back on every tab, filter and open sheet return to the same thing.
- Tests render the page as the shell does: inside a router at the page's URL and `ToastProvider`; a page that calls `useLeaveGuard` needs a data router with `LeaveGuard` above the route (`pages/groups/GroupPage.test.tsx`). An open dialog makes the page behind it inert, so query the page only after the dialog closes. A `Panel` or `FormSection` is a region named by its title, which scopes a query to it.
- Your report says which template you used, any place you departed from this guide and why, and anything you think the guide gets wrong.

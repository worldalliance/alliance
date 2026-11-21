# Decisions

All entries are agent decisions (agent judgement) unless marked otherwise. The brief for this PR came from the agent running the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell` (requirement 8 there: later phase 1 PRs are carried out by subagents). Its points are agent proposals, not owner requirements; the ones below marked "from the brief" are carried out as given. The owner could not be asked; open product choices are listed at the end.

## Members list

- `PageShell` titled "Members", full width for the table. `meta` shows the member count, or "shown of total" while filters narrow the list (from the brief).
- Search, role, tag, contract and action progress sit in one `FilterBar`, each kept in the URL: `q`, `role`, `tag`, `contract`, `progress` (from the brief). Updates replace the history entry, as on the Actions page.
- The old defaults stay: only signed members show, and nothing else is filtered. "Contract: Signed" now shows as a chip, so it is visible that the list is filtered; removing it shows every contract status (from the brief).
- Behaviour change: the contract and progress filters now apply to the grid as well as the list. Before, they lived inside the table, so the grid showed unsigned members the list hid. PR 3 made the same call for the Actions page: a filter that silently doesn't apply to the view on screen misleads.
- The single-choice "Any status / Caught up / Not caught up" and "All / Signed / Suspended / Not signed" dropdowns became checkbox sets, like the Actions status filter. Every old choice is still reachable; combinations such as "Suspended or not signed" are new.
- Option counts stay beside each option, as the old dropdowns showed them. Contract counts are taken after search, role and tag; progress counts after the contract filter too, as before.
- Role and tag keep their "match any checked, none checked filters nothing" meaning. `FilterBar` gains a third kind, `AnyOf`, for it, and an optional per-option `count`. The existing `Options` kind means "all checked filters nothing", which for tags would mean unchecking every other tag to pick one.
- With no tags, the tag filter is left out rather than showing an empty group. A `tag` in the URL is never dropped silently: the list and its count wait for tags to load, with the linked tag reading "Loading…"; a failed tag load shows an alert, the tag reads "Unavailable", and the list is not filtered by tag, as the alert says; only once tags load does a tag that no longer exists show as an "Unknown tag" chip matching nobody. Each such tag's label carries its id, so several can be told apart, and changing the tag filter writes them back to the URL with the rest of the selection.
- A `progress` in the URL waits for action progress the same way, since every member counts as not caught up until it loads. If action progress fails to load, an alert says members can't be filtered by it, and the progress filter is not applied, rather than showing an empty list. A linked one still shows as a chip without counts, as a failed tag does, so Clear all removes it.
- The old "Reset filters" button becomes the filter bar's Clear all, which clears search, role, tag and action progress and returns the contract filter to Signed only, keeping the List/Grid view. "No members match these filters." has no button of its own, as on the Actions page.
- The search box no longer takes focus on load.
- "Manage tags" is a secondary header action, not a `menu` item. `PageMenu` items are buttons, and `ux-guidelines` asks that anything that goes somewhere is a real link, so it opens in a new tab and can be copied. The brief allowed either.
- The unlabelled list and grid icons became a "View" `SegmentedControl` with List and Grid, kept as `?view=grid` (List leaves it out), matching the Actions page's `view` param. The old `?viewMode=cards` links now open the list: the param is not read, since it only chose a view on an admin-only page and losing it costs one click. The shuffle icon became a "Shuffle order" button; it applies to both views (from the brief).
- The table keeps its dense rows. Its own "Members" heading and filters are hidden through a new `showMembersHeading={false}` prop on the shared `CommunityMembersTable`; the group page and the frontend keep theirs. The prop's type rules out pairing it with `showContractFilter`, which would filter invisibly.
- The action history bars get a key above the list, built from `PILL_STATUS_DATA`, so each colour has a word and a new status joins it. The key uses the words the bar's tooltip shows ("Not yet completed", "Member away"), so one colour has one name on screen. Each bar is also exposed as an image named "action - status" in those words, so screen readers read it (`ux-guidelines`, use of colour and non-text content). Only ungrouped bars name a member's withdrawal reason, as before the redesign: week-grouped bars are also what members see of each other on the community page, and a member's reason is private to them and staff. The bars still differ by colour alone at a glance; patterns or shapes would be new design work.
- Loading, failed and empty lists now read differently ("Loading members…", "Couldn't load members…", "No members yet.", "No members match these filters."). Before, the list showed empty while loading or after a failure.
- `MemberFilterDropdown` is deleted; nothing else used it.
- `UsersList.test.tsx` passed 500 lines once its progress tests served a member who is caught up, so it splits like `WaitlistPage`'s tests: `UsersList.testHarness.tsx` (served API, fixtures, render and filter helpers), `UsersList.filters.test.tsx` (search and filters) and `UsersList.test.tsx` (loading, sorting, cards, table). The root `AGENTS.md` asks for a read-only codex consult on splits first; the `codex` CLI isn't installed on this machine, so the split is this agent's choice alone.

## Search params

Found while verifying in the browser (dev build, 761 members): typing quickly into a `FilterBar` search dropped characters, and a second URL update before the first rendered undid the first. Both are fixed in PR 3's own commits and recorded in `01a1ed4a-beb8-7000-a427-43be3a7c0c5c-admin-redesign-core-pages`.

`readBuckets`/`writeBuckets` delegate to a generic `readSetParam`/`writeSetParam` (`lib/setSearchParam.ts`), now that the members page has four set-valued params.

## Contract status

`contractStatus` and `CONTRACT_STATUS_LABEL` in `shared/lib/contract.ts` replace three copies of the "Signed / Suspended / Not signed" mapping (the members table, the member card and the member page). The text colours live in `lib/contractStatusStyle.ts` for the card and the contract section.

# Decisions

All entries are agent decisions (agent judgement) unless marked otherwise.

## Phase 1 is split into four PRs

Requirement 2 asks for reviewable phases. Phase 1 ships as four PRs:

1. Shell, navigation and `PageShell`.
2. The merged action workspace.
3. Projects, the actions list and Stats.
4. Members.

Each primitive is introduced in the first PR that has a page using it, per the root `AGENTS.md` **Less is more** rule, with one exception. `PageShell`'s overflow menu (`PageMenu`) lands in PR 1 before any page uses it, because PRs 2 and 3 both need it and run in parallel as subagents (requirement 8). Building it once up front stops them building two. The other primitives are split so that each PR owns its own:

- PR 2: tabs and the status pill.
- PR 3: sections, stat tiles and the filter bar.
- PR 4: stacks on PR 3 to reuse its filter bar.

## Navigation layout

This layout carries out requirement 5.

- Top level: Stats (home, per requirement 4), Needs reply, since it is the main queue with a count, and Texts, the SMS threads beside it.
- Work: Projects, Actions, Priority, Scheduled plans, Contracts, Kora participants. Projects stays directly above Actions, as `01a1796c-4ae8-7000-b6b3-16f29ae23ec8-admin-projects-page` requires.
- People: Members, Groups, Waitlist, Welcome queue, Away members, Staff directory.
- Growth: Invites, Invite links, Ambassador program, Outreach partnerships, Organizations.
- Content: Action updates, General updates, Forum posts, Videos.
- Insights: Event log, Live invite feed, Member map, Clusters, Friend graph.

Search-only pages are the ones judged rarely used. Each section lists its own in a "More" dropdown at its end (requirement 7). The dropdown shows the current page's name and highlights when you're on one of them; the longest matching path decides which entry is current, so `/invites/graph` marks Invite graph rather than Invites. The search-only pages are: Forms, Formulas, Member lists, Member tags, Waitlist emails, Invitation message, Invite graph, Custom links, Share links, Share targets, Hosted docs, Image upload and Test push notification. Before this change, Forms, Member tags, Invite graph and Test push were in neither the sidebar nor search; now search reaches them. `/timeline`, an unfinished prototype that was in neither, stays out of both. Search shows each page's section as its detail. No usage data informed the choice of rarely used pages. If one turns out to be used often, move it from `more` to `links`.

Texts, Formulas and Member lists arrived on main while this redesign was in review. Texts sits beside Needs reply, as it did in the old sidebar, with a phone icon, since Forum posts already uses the speech bubbles. Formulas and Member lists, the action planning inputs, join Forms in Work's More dropdown.

With every section open, the list outgrows a laptop window, so the sidebar scrolls the current page's row, or its More dropdown, into view. The old folders opened only the current one, which usually kept it in view.

Kept from earlier tasks:

- The current page is highlighted, and counts still sit after the label: Needs reply, Groups, Outreach partnerships. Counts are dark grey rather than red, since requirement 6 keeps colour for status; red marks only a count that couldn't load.
- The house link to the member zone (`01a1a2bf-06f8-7000-bbd2-6e5a3e215378-admin-member-zone-links`) and the Log out icon (`01a0d01b-…`) move into the sidebar footer, still at the bottom left.

The Kora participants icon changes from a baby to audio lines, since Kora reviews transcripts.

Section labels name their links' group for screen readers rather than being headings, and the sidebar's product name is no longer the page's `h1`, so a page's own title is the first heading in its outline. A page whose title is an `h2` has no `h1` until it moves onto the page shell this redesign adds.

## Collapsing hides the sidebar's links

Collapsing hides the nav links, as it hid the whole sidebar before. A 56 px strip keeps the expand toggle, a short environment badge, search (⌘K still works) and the footer's icons. Its links are not shown as an icon rail: `ux-guidelines` lets an icon stand alone only for close, search, send, delete and settings, so a rail of nav icons would leave sighted staff guessing which link is which.

The collapsed state persists in localStorage. It replaces the per-folder state of `01a0d01b-…`, which requirement 5 retires.

## Environment badge replaces the staging stripe

The fixed 24 px staging stripe covered the top of every page's content. A badge under the product name now reads Production (red), Staging (amber) or Local (zinc). The word carries the meaning and the colour backs it up. Production used to turn the whole title red; now only the badge is red.

Trade-off: the two routes outside the sidebar (the live invite feed and the Kora transcript preview) no longer show an environment marker. No recorded requirement covered the stripe; its origin is unrecorded.

## One main landmark

The sidebar layout wraps every page in one `<main>` landmark. The Ambassador program page's own `<main>` becomes a `<div>`, since one `main` can't sit inside another.

## Visual system

These follow requirement 6 and the values the `ux-forms-platform` **Visual system** item lists:

- Tailwind's zinc scale for neutrals; red, amber and green only for status.
- 14 px body text, 20 px semibold page titles.
- A 4 px spacing scale and 100–150 ms transitions.

The redesigned pieces use zinc, amber, `rounded-md` and named text sizes. Normalising the rest of the admin panel to that scale is separate work, which `01a1eb0a-3d46-7000-8d98-c3e8f06b4484-admin-action-flow-and-visual-cleanup` requirement 3 left out. No new theme tokens were added because the Tailwind palette already serves as the token set.

`PageShell` page widths:

- Narrow `max-w-3xl`, for reading lists such as Needs reply.
- Default `max-w-6xl`.
- Full, for wide tables.

The header is a white band with a bottom border over the `bg-page` canvas.

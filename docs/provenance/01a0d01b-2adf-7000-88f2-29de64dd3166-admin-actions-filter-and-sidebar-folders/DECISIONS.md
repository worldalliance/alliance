# Decisions

## Category filter

- **The sidebar action list was removed along with its query.** The user's stated goal was removing it once the filter replaced it.
- **Categories follow the old sidebar groups but are exclusive.** `actionCategory` puts onboarding first, then goes by status: `draft` → Draft, `member_action` → Active, `completed` → Completed, and every other status → Pending. The sidebar had shown an onboarding draft under both Draft and Onboarding; exclusive categories make the filter a plain partition. With every category checked, all non-archived actions appear (88 of 88 locally).
- **The filter is a multi-select checkbox menu that defaults to Active, Pending and Draft.** That default reproduces the calendar's previous contents (non-onboarding, non-completed). The selection isn't persisted, so a reload restores the default.
- **Actions without events render as empty rows after the rest.** Their status falls back to `draft`, and the timeline used to skip them, so drafts the sidebar listed (4 locally) would otherwise have nowhere to appear. This applies to every `ActionTimeline`, including the suite page.
- **When the filter matches nothing, the header still renders above the empty message.** Otherwise the filter would hide itself.
- **Archived wasn't added as a category.** The page drops archived actions when it loads. It's the obvious answer to "+etc?" and was left for the user to decide.

## Create menu

- **The "+" opens a menu (New Action, New Suite, Paste JSON).** The old green button went straight to New Action on click, and its chevron opened the menu; a single icon can only do one of those, and the menu keeps all three reachable.
- **The green matches `ButtonColor.Green`,** including its border and hover shade.
- **Paste JSON still invalidates `queryKeys.actionsAllAdmin()`.** `useActionAdmin` reads that cache key.
- **The heading row that held Create was removed from the sidebar,** since a bare "Actions" heading had nothing under it.

## Sidebar

- **Log out is an icon button with a "Log out" `title` and `aria-label`.** The email next to it truncates, so a long address can't push the icon out.
- **The nav lives in `components/SidebarNav.tsx`.** Link data, folders and highlighting are there; `sidebar.tsx` keeps the shell and passes in the two badge counts.
- **Open folders are stored as a JSON array under `alliance.admin.sidebarOpenFolders.v1`.** Unknown folder values are dropped one by one rather than failing the whole read, so renaming a folder only loses that one entry. Malformed storage reads as all-closed. This follows the zod-plus-`R.fromThrowable` pattern in `responses-table/persistence.ts`.
- **Visiting a page adds its folder to the saved open set** rather than forcing the folder open while there, so the folder can still be collapsed on its own page.
- **Reading `localStorage` in the initial state is safe** because the admin app has `ssr: false`, so the sidebar only ever renders in the browser.
- **A collapsed folder shows the sum of its links' red counts.** Only Outreach has one today. The count that used to sit on the "Extras" row now appears only on Outreach and on Outreach Partnerships.
- **Active highlighting marks links with `aria-current="page"`.** A link is active on its own path and on sub-paths, so `/actions/159` highlights Actions; Stats (`/`) only matches exactly, since every path starts with `/`.

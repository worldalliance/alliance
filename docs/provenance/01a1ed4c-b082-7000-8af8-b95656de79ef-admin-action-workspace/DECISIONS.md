# Decisions

All entries are agent decisions (agent judgement) unless marked otherwise. The brief this PR was carried out from was written by the agent running the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell`; its layout choices are agent proposals, recorded here rather than as requirements.

## Four tabs and their sub-views

Requirement 1 asks for about four tabs. The workspace at `/actions/:actionId` has:
- Overview: the staff testing control and the Release panel first, so launching and scheduling sit where the action's state is read. An action without a suite shows the Release panel, which points to Events, only in Draft and Staff testing; once scheduled, it has nothing to schedule there. Then a Project row, then the existing completion, stats, chart, timeline and response reports.
- Content: the copy guidelines link, the readiness checklist, the action editor, then a segmented sub-view for Task form, Form variants and Follow-up forms.
- Communications: Events and Updates, stacked, each with its own heading and anchor (`#events`, `#updates`).
- Responses: the merged responses table, with Cohort decisions as a sub-view.

The tab lives in `?tab=` and the sub-view in `?view=`, so Back, Reload and a copied link return to them (`ux-forms-platform`, URL state). Switching main tab drops `view`. Tabs are real links with `aria-current="page"` in a labelled `nav`, not an ARIA tablist, because each one is a navigable URL. A link inside a tab that opens another tab unmounts with it, so focus then moves to the new tab's link, as main's action dashboard (#1028) moved it to the tab button.

The task form is a sub-view rather than a collapsed card, as on the old project action page. While it is open its unsaved edits block Duplicate and the release controls, as they did there; leaving the sub-view clears that once the form unmounts, since the form builder's own leave guard has asked by then.

## Old URLs

Old `?tab=` values redirect in place with `replace`: `details` to Content, `events` and `updates` to Communications at their section, `form`, `form-variants` and `follow-up-forms` to Content with that sub-view and anchor, `cohort-decisions` to Responses with that sub-view. `overview` and `responses` keep their names. The old route `/projects/:projectId/action/:actionId` redirects to `/actions/:actionId`; an `ActionEditorSection` anchor lands on its tab (`#release` on Overview, `#details` and `#task-form` on Content), anything else carries over. Links inside the admin now point at the new places directly. The redirects are permanent: bookmarks and links pasted elsewhere have no end date, so no `BACKCOMPAT` tag applies.

Hash anchors on another tab need scrolling after the tab renders, which react-router's `ScrollRestoration` does not do for the inner scrolling `main`, so the workspace scrolls to the hash element itself once loaded.

## One status pill

`StatusPill` renders a word with a tone. `StatusTone` has five values: neutral (zinc), attention (amber), live (blue, requirement 6), positive (green), negative (red), following requirement 2's colour-for-status rule; blue joins the shell's red, amber and green as a status colour. `lib/actionStatusDisplay` keeps the status words and maps each status to a tone in place of its old colour classes (purple, indigo and orange are gone, and blue now marks only live states); `ActionPhasePill` keeps the phase words and maps each open phase to a tone. A closed action's pill now shows its status word (Completed, Failed, Abandoned, …) instead of the project-count bucket (done, wrapping up), so the project page and the action page use one vocabulary. The project card counts in `lib/projectCards` are left to PR 3.

Tones: Draft, Scheduled, Planned, Office action and Abandoned are neutral; Staff testing and Resolution need staff attention; Live and Member action are live; Completed is positive; Failed is negative. The header shows the phase pill, and beside it the status word when the phase is open and doesn't imply the status (anything but Draft or Member action), since the phase follows only the member action: an office-only action reads Draft and Office action. The staff testing control no longer repeats the phase, and the old Overview "Status" card is gone.

## Header

- `PageShell` with the action name as title, the phase pill and an Archived pill in `meta`, and the slug, project link and suite link under the title. `PageShell`'s description changes from `<p>` to `<div>` so it can hold the slug editor.
- "View action page" is the one visible button. Duplicate action, Export JSON and Archive action / Unarchive action sit behind More; Archive is marked destructive (listed last, in red) because it hides the action from members, Unarchive is not.
- Duplicate is disabled with its reason while the cover image uploads or anything on the page is unsaved, since it copies the saved action and the saved task form.
- Export JSON opens a small modal with the three include checkboxes and a Copy JSON button.
- The project category picker and Delete project leave the action page; both stay on the project page. The action's category icons in the old header are dropped, since the editor's category field shows them.
- The workspace uses `PageWidth.Full`: the form builder and charts need the width, and a header that changed width between tabs would jump.

## Staff preview control

Requirement 4 sets where the editor's Staff preview checkbox appears. "Outside a project" means the action has no `project`; "scheduled or live" is `actionPhase` returning Scheduled or Live, so a closed project action hides the checkbox too. `editorShowsStaffPreview` in `lib/staffTestingGate` decides it, and the workspace passes the result to the editor.

The Overview's Start/Stop staff testing control shows in Draft and Staff testing, and Stop staff testing also shows on a Closed action that never launched with its staff preview still on (once the Member action event starts, the server ignores the flag), so on a project action the two controls never appear together. On an action outside a project they do, and they stay in step: both read and write the same `staffPreview`, the Overview control updates the editor's form and saved baseline when it saves, and it is disabled with "Save your changes on Content first" while the checkbox, or any other edit, is unsaved. On a scheduled, live or launched closed action, where there is no toggle, the same notice still shows while edits are unsaved, because they also lock the release controls below it.

The staff testing readiness gate (short description, body, task form, cohort) applies only where the Overview control is the only one, that is to project actions. On an action outside a project the checkbox never enforced it, so a blocked Overview button beside a checkbox that turns staff preview on regardless would contradict it; there Start staff testing is not blocked, as before this PR, and the Content tab's readiness checklist still lists what is missing. The owner approved this as requirement 5.

The checkbox keeps its hint, which says staff preview lasts indefinitely when no Member action event is scheduled, the case on every action outside a project in Draft. On a live action the flag no longer affects what anyone sees, since staff preview ends when the Member action event starts; the checkbox is there so it can be turned off.

## Project row

"In project <name>: step n of m", from the project's step list, with the project picker beside a visible "Project" label. Its Rename and New project buttons now carry words, per `ux-guidelines` (icons stand alone only for close, search, send, delete and settings). A failed project list load shows an error instead of an empty picker.

## Readiness checklist

Starts collapsed with "n/m ready" and the missing items' names inline. The heading holds the disclosure button (`aria-expanded`), instead of a heading inside a button.

## Form outline scrolling

The form builder's outline revealed its selected entry with `scrollIntoView`, which also scrolls every container around it. Below the editor on the Content tab, that dragged the page down to the task form on every load. It now scrolls only its own scroller (`lib/revealInScroller`). On the form builder page the outline already sat in its own scroller, so nothing changes there.

## Clean-up

Deleted: `ProjectActionPage`, `ActionDashboardToolbar` and its test (its Duplicate cases moved to `ActionWorkspace.test.tsx`), `ActionProjectSteps`, and the `inClipboard` copy string. `ActionDashboard.tsx` is renamed `ActionWorkspace.tsx`; the `action-dashboard/` and `project-action/` folders keep their names to keep the diff reviewable.

## Choices the owner left to the agent

The owner answered "I don't care" to each of these, so they stay as agent decisions that a later agent may change if they cause friction:
- Archive is styled as destructive in the More menu (listed last, in red), as described under Header.
- A closed action's pill shows its status word (Completed, Failed, Abandoned, …) rather than the project-count bucket, as described under One status pill.
- A project action closed before launch, with staff preview still on, gets Stop staff testing in Overview's header, since the editor hides its checkbox on closed project actions. The owner deferred how such an action's staff preview is ended; this keeps requirement 4's checkbox placement unchanged rather than showing the checkbox on closed actions.

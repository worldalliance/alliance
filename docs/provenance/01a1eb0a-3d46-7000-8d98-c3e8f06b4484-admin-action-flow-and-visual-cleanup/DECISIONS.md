# Decisions

The user deferred which improvements to make and how (REQUIREMENTS.md 2), so every entry here is an agent decision a later task may revisit.

## Scope

This task covers safety and feedback in the action flow. The class-name cleanup is left out (REQUIREMENTS.md 3). Restructuring the actions list, the dashboard tabs and the action form, moving the remaining hand-rolled buttons onto the shared `Button`, and a shared page header are left for later tasks: each changes layout and needs its own review.

## Safety

1. Adding a "Members taking action" event from the event form, for an action or a suite, asks for a typed confirmation ("launch to real members"). The form previously launched on one click. The phrase does not reuse `notifyRealMembersText`, because a bare event sends nothing by itself; reminders do, and none can exist before the launch event does. The question can stay open past the times it asks about, so once staff confirm, a scheduled launch whose time has passed, or a deadline no longer after the launch, is refused with a message instead of written. Other statuses that take a Draft action out of Draft also make it visible; confirming those is left to a follow-up (ALL-2424).
2. The action editor (dashboard and project page) and the update details form warn before a navigation or reload discards unsaved edits, through `useLeaveGuard`, extracted from the form builder's guard in `useSavedForm`. `useActionEditor` calls it itself, so every page using the editor is guarded. React Router honours one blocker at a time, so guards register in one set and `LeaveGuard`, rendered once in the admin layout, owns the blocker that asks them all. The dashboard and update page allow navigations that keep the path, since tab changes keep their draft. A cover image still uploading counts as unsaved while its action is the one in the editor. A save that resolves after staff move to another action leaves that action's draft alone. A field set back to blank is unchanged, whether its blank is absent, null or empty. A new action compares against its empty draft, and the navigation to the action just created runs through the unprompted navigation `useLeaveGuard` returns, which skips only the guard that returned it, so a save that outlives its page never silences another page's guard. The prompt is the browser's leave-or-stay confirm the form builder already used; a Save and Discard prompt is left to a follow-up (ALL-2422).
3. Sending an update's notification asks for the same typed confirmation as launching, with its own phrase (`notifyRealMembersText("many")`), in place of a browser `confirm`. The recipient count is not shown: the page has no count for an update's audience. Both confirmations use the shared fullscreen confirm in `ToastProvider`, as reminders and suite launch already do, and close unanswered when the page's path changes, since each write follows the route's id. It lacks a dialog role, a focus trap and Escape for every caller; fixing that in the shared component is left to a follow-up (ALL-2213) rather than built into this task.
4. "Manage priority" is a router link, so it no longer reloads the page mid-edit.

## Feedback and dead ends

5. Saving an action or an update's details shows a "saved" toast.
6. Only an action's name is required in the form. Short description and body lose their unused `required` flag: drafts are saved without them, and the readiness checklist owns them.
7. "Create and write content" stays enabled and says what is missing when pressed.
8. The actions list gains a "Show archived" checkbox, off by default, so archived actions can be found and unarchived. It sits beside the status filter rather than in it: that filter narrows only the timeline, while archived actions appear in both the timeline, marked, and the list.
9. A suite needs a name; the field has a visible label.
10. Delete stays unavailable for actions. Its button was commented out before this task, and whether actions should be deletable is a product decision this task does not make. The commented-out markup, the handler chain that fed it and the delete mutation in `useActionAdmin` are removed.

## Wording and navigation

11. Labels and buttons in the action flow, and on the other admin pages this task touched (projects, scheduled plans, contracts, general updates, posts), follow the root `AGENTS.md` capitalisation rule. The "Event Management" tab is renamed "Events".
12. The action list card, the dashboard's back control and the create control are links or labelled buttons. Page titles name the page or the action.
13. Local times in the touched screens name their zone through `formatDateTimeWithZone`, added beside the other formatters in `shared/lib/dateFormatters.ts`. Other screens still use the forms the audit listed.

## Visual

14. The "Archived" and "Optional" badges on the action card are neutral, so red stays for danger and blue for selection.
15. The shared success toast is darkened from `emerald-600` to `emerald-700` in every app: its white text fell below the 4.5:1 minimum, and this task adds toasts on it.

## Added after review

16. The sidebar shows a "Production" badge in production. The title was already tinted red there; the badge names the environment in words, since colour alone is no cue.
17. On the action dashboard, Duplicate is disabled while the action editor has unsaved edits, with a visible reason: it copies the draft and then leaves the page, so the leave prompt would come after the copy exists. Edits made while the copy is created still meet that prompt, so a toast announces the copy first.
18. `useLeaveGuard` throws outside `LeaveGuard`, which wraps the admin routes, so a page that loses the navigation prompt fails loudly instead.

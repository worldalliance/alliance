# Decisions

The user deferred which improvements to make and how (REQUIREMENTS.md 2), so every entry here is an agent decision a later task may revisit.

## Scope

This task covers safety and feedback in the action flow. The class-name cleanup is left out (REQUIREMENTS.md 3). Restructuring the actions list, the dashboard tabs and the action form, moving the remaining hand-rolled buttons onto the shared `Button`, and a shared page header are left for later tasks: each changes layout and needs its own review.

## Safety

1. Adding a "Members taking action" event from the event form, for an action or a suite, asks for a typed confirmation ("launch to real members"). The form previously launched on one click. The phrase does not reuse `notifyRealMembersText`, because a bare event sends nothing by itself; reminders do, and none can exist before the launch event does.
2. The action editor (dashboard and project page) and the update details form warn before a navigation or reload discards unsaved edits, through `useLeaveGuard`, extracted from the form builder's guard in `useSavedForm`. React Router honours one blocker at a time, so guards register in one set and `LeaveGuard`, rendered once in the admin layout, owns the blocker that asks them all. The dashboard and update page allow navigations that keep the path, since tab changes keep their draft. A new action compares against its empty draft, and the navigation to the action just created runs through `withoutLeaveGuard`, the one bypass, which the form builder's own post-save navigation uses too.
3. Sending an update's notification asks for the same typed confirmation as launching, in place of a browser `confirm`. The recipient count is not shown: the page has no count for an update's audience.
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
17. On the action dashboard, Duplicate is disabled while the action editor has unsaved edits, with a visible reason: it copies the draft and then leaves the page, so the leave prompt would come after the copy exists.
18. `useLeaveGuard` throws outside `LeaveGuard`, which wraps the admin routes, so a page that loses the navigation prompt fails loudly instead.

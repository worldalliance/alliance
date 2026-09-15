# Decisions

## Model

- **Stored toggle, derived state.** `action.staffPreview` is a plain boolean column that admins set. "Preview is active" is `staffPreview && no member_action event has started`, computed in `isStaffPreviewActive` (`server/src/actions/staff-preview.ts`) on every read. This meets the requirement that there be no stored "is active" flag and no manual turn-off.
- **No member_action event scheduled counts as active.** The action hasn't gone out, so preview holds for as long as the toggle is on.
- **The client gets a per-viewer flag.** The flag is `viewer.staffPreview` (true only for `user.staff`), not the raw toggle. Clients branch on one field that is already scoped to staff and to the preview window. The raw toggle is sent only on `AdminActionDto`, for the admin form.
- **Archived actions never preview.** `userCanSeeAction` checks `archived` before the staff preview rule.

## Visibility

- **Staff see previews regardless of cohort or visibility mode.** This reads "all staff" literally. Only `userCanSeeAction` changes. Assignment, rosters, `usersJoined`, and suspension accounting are untouched, so notifications and counts don't include staff because of a preview. Reminder task lists read `userCanSeeAction` through `findMemberPublic`, so `findUncompletedTasks` drops drafts to keep a preview out of reminder counts and names.
- **Feeds follow the same rule, unmarked.** The global feed, timeline feed, activity feeds, and action updates list filter through `userCanSeeAction`. Staff therefore see a preview's published updates and events there, with no preview marker. Hiding them would take a second visibility rule that every feed caller has to choose between. Opening one of these items lands on the action page, which is marked.
- **Share codes grant nothing.** The requirement about share links is met because nothing in visibility looks at share codes. A non-staff visitor opening a link to a draft in preview gets the same 404 as for any draft. A preview on a `planned` public action changes nothing for non-staff: they see the page as before.
- **The actions list page is unchanged for staff.** The shared actions query now keeps drafts that are in staff preview, since the home page needs them, and `filterActions(All)` drops drafts so the list page looks the same as before. It filters on draft status, not on the preview flag, so a preview that isn't a draft stays in the list for staff, as it does for everyone else who can see it. The Tasks nav badge does count a preview, because it counts home-page todos.

## Refused writes

- **Refusals apply to everyone, not just staff.** They are keyed on the action being in preview, and they return 403 `This action is in staff preview`. The requirement describes preview as a property of the action ("while in preview, submissions should not work").
- **Where the checks sit:**
  - `createActionActivity`: completion, withdrawal, dismissal, follow-up activity, and the payment webhook's completion.
  - `tasks.submitForm` and `tasks.optoutForm`: checked before any side effect, so no form response is saved and no profile update, MMS, or contract signing happens.
  - `getPaymentAmountForAction`: runs before a Stripe payment intent is created, so donations fail before money moves.
  - `likeActivity`, which covers unlikes too.
  - `ForumService.createComment` and comment like/unlike, when the comment's parent is the action or one of its activities.
- **Admin-created activities are exempt.** This covers the admin override endpoint and the forum autocompleter, which runs near deadlines and so after launch anyway.
- **Not blocked:** editing or deleting comments that already exist, and comments on forum posts linked to the action. These aren't "comments on the action" in the sense the interview covered, and no comment can be created during preview.
- **`submitPublicForm` is not checked.** It takes a form id with no action context, and guests can't see a draft in preview.
- **`computeCanCompleteAction` is untouched.** Folding preview into it would flip `viewer.canComplete` for non-staff members before launch, which changes what they see on the action page.

## Client

- **Home list inclusion.** `shouldCompleteAction` returns true for `viewer.staffPreview`, except on public-only actions, which never reach the home page after launch. `canCompleteAction` stays false because the member_action phase hasn't started, so every existing "can submit" gate still says no.
- **No dismiss banner in preview.** `getTaskDismissInfo` returns nothing, because dismissal would be refused.
- **Form preview reuses FormRenderer's existing admin preview mode.** On web, `onSubmit={null}` without `renderFormAsCompleted` gives an editable form with a "(Preview Mode)" button that only validates. Mobile's FormRenderer treated `onSubmit={null}` as read-only. It now matches web; every existing mobile caller that passes `null` also passes `renderFormAsCompleted`, so their behavior is the same.
- **Preview validates every page, on web and mobile.** Mobile already did this through `handleSubmit`. Web's preview button now calls `validateAllPagesAndShowFirstInvalid`, the same helper a real submit uses, so it jumps to the first invalid page. Like the real submit and mobile, it waits out file uploads: the button is disabled while one is running, because the file field has no answer until it finishes. The admin form builder's preview shares this button, so it changes there too.
- **Preview typing isn't kept.** The form gets no `persistKey` and no guest-draft fetch, so answers typed in preview don't prefill the real form after launch. `onFormStarted` is a no-op, so previews don't emit FormStarted analytics.
- **A planned action in preview still shows its task section.** The action page, web and mobile, hides the task section while an action is `planned`. `showActionPageTaskSection` makes an exception for staff preview, so the preview form shows up on the action page as well as on the home card.
- **Only Activity actions with a task form render the preview form.** Funding actions render no task panel in preview. The banner still marks them.
- **Preview markers.**
  - Web home card: an alert-style banner with an eye icon and the words "Staff preview".
  - Web navigator row: an eye icon with a tooltip.
  - Mobile home card: a banner styled like the dismiss banner.
  - Action page, web and mobile: a new `ActionPageTaskPanelState.StaffPreview` header. It is checked before the cannot-complete check, so staff outside the cohort get the preview form instead of "not assigned".
- **Snapshot at the moment of launch.** `viewer.staffPreview` is computed at fetch time, like the rest of `viewer`. A page open across the member_action start keeps showing the preview until it refetches. The server stops refusing writes at the start time.

## Admin

- **The checkbox is "Staff Preview" in the action settings section.** On `CreateActionDto` the field is optional and validated with `@IsBoolean`. When omitted, the column default (off) applies.
- **Deleting a form variant before launch also deletes its assignments.** Staff who load a preview get a saved variant assignment, and a variant with assignments can't be deleted. The exception is keyed on the member_action start, not on preview being active, so an admin who turns preview off before launch can still delete the variant. Clients only allow submitting once member_action starts, so no answers hang off those assignments, whether preview is on or off. Those users get a new pick on their next load.
- **A variant whose form has responses keeps the old rule, even before launch.** "Before launch" comes back if an admin moves or deletes a started member_action event. The assignments then belong to members who may have already submitted. Clients only submit after launch, so a response on the variant's form marks those assignments as real.

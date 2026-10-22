## Decisions

- The rule is `ActionVisibilityService.listableActions` in `server/src/actions/action-visibility.service.ts`: `userCanSeeAction` less public-only actions. The member action feed (`ActionsService.findMemberPublic`) and search (`ActionsService.findByName`) both call it.
- Search follows the feed's rule for admins too: an admin's search now includes draft and archived actions and leaves out public-only ones, as the admin's feed does. Public-only actions are meant for non-members, and search requires a signed-in member.
- `ActionsService.findActionRelationsForUsers` keeps its own `!archived && status !== Draft && !publicOnly` filter. It picks the columns of the admin member-by-action matrix for many users at once, with no single viewer, so `userCanSeeAction` (per viewer, admin bypass, staff preview, cohort) is a different contract.
- `ActionsService.findUncompletedTasks` keeps its `status !== Draft` check on top of the feed. It is a task rule, not a visibility rule: reminders never list a draft, even to admins and staff previewers who can see it.
- Activity, update, and timeline feeds keep `visibleActionIdsForUser`, which does not exclude public-only actions; they list activity on an action rather than the action, and that contract is unchanged here.

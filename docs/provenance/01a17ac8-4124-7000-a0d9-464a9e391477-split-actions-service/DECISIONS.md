# Split ActionsService under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file. Methods move by concern into services in `server/src/actions/`, registered in `ActionsModule`, with their bodies unchanged apart from how they reach what stayed behind:
  - `GlobalFeedService`: the global feed and the timeline feed.
  - `FeedMembersService`: the ranked member queries behind the global feed's facepiles, and the paginated activity-group, new-member and forum-comment member lists.
  - `ActivityOutputService`: the public output of a completion's form response.
  - `ActivityFeedService`: the activity lists (global, per action, friends, community, a member's completions, one activity) and the query and DTO helpers they share.
  - `HomeFeedService`: the home and profile feeds.
  - `ActivityLikeService`: liking and unliking an activity.
  - `ActionSuspensionService`: the missed-suite streak behind automatic suspension, its plan preview, and the closed-suite outcomes missed-suite notices read.
  - `ActionShareService`: the share preview, referral codes, an action's share links and the referral leaderboard.
  - `SchemaWriteService`: the guarded display-only schema write that general updates and action updates share.
  - `GeneralUpdatesService`: general update reads, writes, dismissal and the suite-date sync.
  - `ActionUpdatesService` and `ActionUpdateNotifyService`: an action update's lifecycle, and sending it with the audience its recognition preview shares.
  - `ActionSuitesService`: suites, and adding events to one action or a whole suite.
  - `FollowUpFormsService`: follow-up form writes.
  - `ActionRelationsService`: the admin and community-leader reports of members' relations to actions, and the community completion count.
  - `ActionImportExportService`: action export and import.
  - `WelcomeQueueService`: the staff welcome queue.
  - `ActionActivityService`: recording completions, withdrawals, dismissals and admin-created activity, and the completion gate in front of them.
  - `MemberActionsService`: the member's action list and open actions, one action's member DTO, uncompleted tasks, the completion block, and the viewer-cohort, follow-up-form and variant-form helpers they share.
  - `ActionFormLinksService`: resolving forms back to actions, the variant check, and a form's withdrawals, with `LinkedAction`.
- Some methods join an existing owner instead: the participant counts go to `ActionParticipantsService`, and the tentative reminder plan preview to `ReminderPreviewService` beside the email and text previews of the same unsaved group.
- The cohort expression parsers become functions in `cohort-reference-validation.ts` beside `assertTagsExist`, and the priority shift both action and general update creation run becomes `shiftPrioritiesAfterInsertion` in `priority-order.ts`; each needs only an entity manager.
- `ActionsService` keeps action create, read, update, delete, archive, priority order, `findAllSorted`, `findOneOrFail`, search by name, and batch cohort evaluation.
- A moved method that called a method staying on `ActionsService` (`findOneOrFail`, `findAllSorted`) now calls it on the injected `ActionsService`. `ActionsService` injects only services that do not inject it back (`GeneralUpdatesService`, `ActionFormLinksService`), so no provider cycle forms.
- One commit per concern, each with its callers and tests, so each commit typechecks on its own. The last one brings the file under the limit and removes the waiver, which eslint reports as unused from then on.

## Left as found

- `ActionsService.findActionById` has no callers, and `ActionsService` injects `editableContentRepository` without using it. `GeneralUpdatesService.deleteGeneralUpdate` has no callers. All three predate this change.
- Moved error logs name their new service as their context instead of `ActionsService`.

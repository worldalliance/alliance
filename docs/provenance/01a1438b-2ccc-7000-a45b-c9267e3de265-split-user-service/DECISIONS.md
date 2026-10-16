# Split UserService under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file. Methods move by concern into services in `server/src/user/`, registered in `UserModule`, with their bodies unchanged:
  - `TagService`: tags and their members.
  - `UserAwayRangeService`: away ranges and the away check reminders use.
  - `UserDeviceService`: device registration and the admin test push.
  - `GroupAssignmentService`: the staff group-assignment queue and batch assignment.
  - `ReferralService`: referral code resolution, the signup page's referrer, and its social-proof avatars.
  - `FriendService`: friend requests and friendships, and the friend and friend-graph reads.
  - `OnetimeInviteService`: one-time invites and invite requests.
  - `AmbassadorInviteStatsService`: the ambassador invite stats query and recruit projection, shared by the two services below.
  - `AmbassadorInviteGoalService`: an ambassador's goals, their dashboard, and the goal notification cron.
  - `AmbassadorProgramService`: the admin ambassador program dashboard, members, and interactions.
  - `UserVisibilityContextService`: the account-derived values form visibility conditions read.
  - `AccountDeletionService`: a member's deletion request and the admin deletion.
  - `UserAdminService`: the admin user list, admin user detail, and admin role changes.
  - `AccountEmailService`: the welcome email and email verification.
  - `UserDirectoryService`: public members, the staff directory, messageable users, and city counts.
- The password reset token's minting moves to `AuthService`, beside `forgotPassword`, its only caller, and `resetPassword`, which verifies it.
- `UserService` keeps account creation (with the invite claim inside its transaction), profile writes, and the general user reads most callers share, including `findOneOrFail`.
- A moved method that called `this.findOneOrFail` or `this.findOne` now calls it on the injected `UserService`, so e2e tests that intercept `UserService.findOneOrFail` still cover the moved writers. No new service is injected into `UserService`, so no provider cycle forms.
- One commit per extracted service, each with its callers and tests, so each commit typechecks on its own. `ReferralService` lands before `OnetimeInviteService` and `FriendService` so `UserService` never depends on a split-out service. The last commit brings the file under the limit and removes the waiver, which eslint reports as unused from then on.

## Controller split

- `user.controller.ts` was 1094 lines with its own waiver, and injecting the new services would have grown it. Root `AGENTS.md` asks for a file past 500 lines to be split before a change adds to it, so its route groups move into controllers first, each in its own commit placed just before the service commit for the same concern: `UserTagController`, `UserAwayRangeController`, `UserDeviceController`, `UserGroupAssignmentController`, `UserReferralController`, `UserFriendController`, and `UserOnetimeInviteController`. The last of these brings `user.controller.ts` under the limit and removes its waiver.
- Each new controller keeps `@Controller("user")` and the same paths, guards, and DTOs, and the one-time invite routes keep their order, so `overview` and `memberStats` still match before `:communityId`.
- `main.ts` builds operation ids from the controller class name, so the moved endpoints' generated client functions are renamed (for example `userGetTagsAdmin` to `userTagGetTagsAdmin`), as the `ActionsController` split did. Each controller commit regenerates `shared/client` and renames the callsites and `shared/lib/queryKeys.ts` labels in `shared`, `apps/admin`, `apps/frontend`, and `apps/mobile`.
- The ambassador, admin, directory, account, and visibility routes stay on `UserController`, which stays under the limit with them.

## Out of scope

- `actions.service.ts`, `tasks.service.ts`, and `action-event-recipient.service.ts` gain constructor parameters and imports for the new services. Each carries its own `alliance/max-lines` waiver; splitting them is that waiver's task.
- Dead code is kept as found, apart from a commented-out query in `getUserCityCounts` that moved and is deleted: `findUserByShareSid`, `countReferred`, `notifyReferrerOfNewMember`, and `getAllUserIds` stay on `UserService`, and the uncalled `userHasCitySet` moved with the visibility context it belongs to.
- The friend-request status error log names `FriendService` as its context instead of `UserService`.

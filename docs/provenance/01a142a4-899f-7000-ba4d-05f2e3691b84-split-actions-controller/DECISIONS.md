# Split ActionsController under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Assignment

- The orchestrating agent assigned this waiver so parallel agents work on separate files. It told this agent to leave `action.entity.ts`, `action.dto.ts`, and the `timeEstimate`/`customStatGoal` fields alone, because PR #668 was changing them.

## Split

- The fix the waiver asks for is splitting the file. Endpoints move into controllers by concern, each still `@Controller("actions")`, so every URL, guard, and DTO is unchanged:
  - `ActionFeedController`: activity, global, home, community, user, and timeline feeds, global-feed member lists, activity likes.
  - `GeneralUpdatesController`: member and admin general updates.
  - `ActionUpdatesController`: action update admin lifecycle, recognition preview counts, member update lists.
  - `ActionRemindersController`: reminder groups, their plans and sent notifications, anchor candidates, message previews, the notification schedule.
  - `ActionSuitesController`: suites and suite events.
  - `ActionFormsController`: follow-up forms and form variants.
- `ActionsController` keeps action CRUD, admin listing and lifecycle, sharing, withdrawals, export/import, scheduled plans, and the user/community relation reads under its existing `// TODO move` marker.
- No two routes across the new controllers can match the same request, so controller registration order does not change which handler answers.
- One commit per extracted controller, each with its regenerated client and callsites, so each commit typechecks on its own. The last one removes the waiver.

## Client names

- `main.ts` builds operation ids from the controller class name, so the moved endpoints' generated client functions are renamed (for example `actionsHomeFeed` → `actionFeedHomeFeed`), as the earlier `WaitlistEmailAdminController` split did. Callsites in `shared`, `apps/admin`, and `apps/frontend`/`apps/mobile` (through `shared`) are updated to the new names.
- `shared/lib/queryKeys.ts` labels each key with the SDK function that fills it, so each commit renames its moved functions' key labels too (for example `"actionsGetActivity"` → `"actionFeedGetActivity"`). Keys still labeled `actions*` name functions that stay on `ActionsController`.

## Left as found

- `ActionsController` injects `EventEmitter2` and `ShareUrlsService` without using them. That predates this change.

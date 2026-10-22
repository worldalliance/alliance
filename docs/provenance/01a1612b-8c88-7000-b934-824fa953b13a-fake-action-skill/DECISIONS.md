# fake-action and fake-engagement skills

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Why the admin API over SQL

`ActionsService.create` (`server/src/actions/actions.service.ts`) does several things that raw inserts would skip:

- it validates the cohort expression with zod and checks that its tags exist;
- it validates prerequisites;
- it runs `shiftPrioritiesAfterInsertion`, which bumps every other action's priority;
- it syncs suite general-update dates.

`addEvent` enforces the single-`member_action` constraint and reloads `usersJoined`. Going through the API means the skill doesn't have to restate any of that.

## What "full audience" sets

- `cohortExpression: {"type":"AllMembers"}`, which the resolver maps to every user.
- `visibilityMode: "all_members"`.
- `publicOnly`, `onboarding` and `archived` are all false.

Admission is still gated by an active contract (`isCohortAdmissible` in `server/src/actions/cohort-decision.ts`). That gate is why the skill signs and re-signs contracts before simulating participation.

## Deadlines and closing

Status isn't a column; it's derived from the `action_event` in effect now (`server/src/actions/entities/action-event.entity.ts`). The deadline event is `office_action`, because local data follows `member_action` → `office_action` → `completed`: those statuses appear 95, 66 and 59 times, and `resolution` appears once.

"Open for more than 3 days" means the status now is `member_action` and that event is more than 3 days old. No route edits an existing event, so closing adds an `office_action` event dated now. That moves the deadline earlier for assigned members, and the server answers 409 until the request carries `?acknowledgeDeadlineShortening=true`. The agent passes the flag because the data is fake.

Two kinds of action are excluded from closing:

- `onboarding` actions, since closing them breaks the local signup flow;
- actions in a suite, since suites schedule their own events.

In the local data, the dry run found that the only actions matching the 3-day rule were onboarding ones.

## Casting members

"Active contract" means the user's latest `contract_event` dated up to now is `signed`. The local db had 211 such non-admin users, so the signing and re-signing tiers seldom trigger. They stay in the skill because the requirements call for them "as needed".

## Cohort timing

Cohort decisions come from a cron that runs every 5 minutes. The member feed also reconciles live. Every cast member, including those who do nothing, fetches `GET /actions/loggedIn` (`buildMemberFeed` → `reconcileForUser`), which writes their `action_cohort_decision` before they act.

## Endpoints

The skill names endpoints and leaves request shapes to `GET /openapi.yaml`, which can't drift from the server. The skill writes out the bodies where the server demands fields that OpenAPI marks optional:

- `submitForm` needs `formSnapshotId`, taken from `GET /tasks/slug/:formId`;
- `optout` needs `partialFormData`, a full submit body.

`createUpdate` makes an empty update with `visibleAt` null. The `PATCH /actions/updateUpdate/:id` that writes its blocks is what publishes it, and with `notifyType: "none"` nothing is sent. The skill also requires `SEND_DEV_NOTIFS` to be unset, so contract signing can't deliver anything either.

## Dry run

A fresh agent followed the skill cold against the local server and created live action 173. It had 14 participants:

- 8 completed;
- 2 withdrew;
- 2 dismissed;
- 2 did nothing.

It also posted one mid-action update and one wrap-up. The friction it hit led to the explicit request bodies, the event model and the close exclusions above. Action 173 was later closed through the documented close call, which exercised the 409-then-acknowledge path.

## Token script

`mint-token.ts` reads `JWT_SECRET` and the db credentials from `server/.env` inside the script, so the secret never enters agent context. It signs `{sub, email, tokenType: "access", sessionGeneration}`, with `sessionGeneration` read from the user row. `SessionService` (`server/src/auth/session.service.ts`) matches the claim against the row and rejects a token whose generation differs. A token that omitted the claim would fail for any user whose generation was ever bumped.

The script reads the user row through `queryLocalDb` (`scripts/lib/local-db.ts`) and the secret through `envFileValue` (`common/src/dev-database.ts`). Those are the repo's existing helpers for reading the local db and `server/.env`. It lives in the skill directory and nowhere else, as the requirements specify.

## Starting the server

When the API port from `./scripts/with-env.sh` isn't listening, the agent starts `bun --watch src/main.ts` in `server/` in the background and waits for `/openapi.yaml` to respond.

## The split

`mint-token.ts` stays in `skills/fake-action/`, and `fake-engagement` calls it by path. One copy keeps a single definition of the token claims. The requirement that the script not move into a shared location for the `playwright` skill still holds.

Both skills need the server step, so `fake-engagement` points to the Server section of `fake-action` rather than repeating it. The `SEND_DEV_NOTIFS` check moves to `fake-engagement`, because contract signing and updates are what can notify; creating an action notifies nobody.

When the agent picks the target action, "little activity" means the fewest `action_activity` rows among actions whose status now is `member_action`. Planned and closed actions can't take participation, but a closed action can still get a wrap-up.

"Members who haven't acted" means users with no `action_activity` row on the action. Members who only fetched the feed earlier have no activity row, so a later run may cast them again.

## Cast eligibility

The cast is limited to the target's cohort (`POST /actions/evaluate-cohort`). A member outside it can't be admitted, and on a narrower action such as a `USMember` one their activity would be implausible. `admin`, `anonymous` and `isTestUser` users are excluded: staff, guests and review accounts aren't members acting on an action.

A form with `variables`, such as a randomly assigned senator, resolves them per member. The skill points to where that happens so that answers match what each member would have seen.

A second cold dry run followed both skills after the split. It created live action 174, ran `fake-engagement` on it, then ran it with no id, which picked action 170, the live action with no activity. Every call succeeded. What it flagged led to the full withdraw and update bodies, the cohort limit, the per-member variables note, and the definitions of status and active contract.

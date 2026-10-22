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

Every skill needs the server step, so `fake-engagement` and `import-fakes` point to the Server section of `fake-action` rather than repeating it. That section also holds the `SEND_DEV_NOTIFS` check: creating an action notifies nobody, but the other two skills sign contracts and post updates, and they follow that section.

When the agent picks the target action, "little activity" means the fewest `action_activity` rows among actions whose status now is `member_action`. Planned and closed actions can't take participation, but a closed action can still get a wrap-up.

"Members who haven't acted" means users with no `action_activity` row on the action. Members who only fetched the feed earlier have no activity row, so a later run may cast them again.

## Cast eligibility

The cast is limited to the target's cohort (`POST /actions/evaluate-cohort`). A member outside it can't be admitted, and on a narrower action such as a `USMember` one their activity would be implausible. `admin`, `anonymous` and `isTestUser` users are excluded: staff, guests and review accounts aren't members acting on an action.

A form with `variables`, such as a randomly assigned senator, resolves them per member. The skill points to where that happens so that answers match what each member would have seen.

A second cold dry run followed both skills after the split. It created live action 174, ran `fake-engagement` on it, then ran it with no id, which picked action 170, the live action with no activity. Every call succeeded. What it flagged led to the full withdraw and update bodies, the cohort limit, the per-member variables note, and the definitions of status and active contract.

## Recording format

`fakeFileSchema` (`scripts/lib/fakes.ts`) is a strict zod schema with two kinds:

- **`fake`** carries the whole action: fields, form schema, project, every event.
- **`staging`** carries only an action name and what the fake skills added to it.

Both carry `recordedAt`, `events`, `participants` and `updates`. Participants are a union on `outcome`, so a completion without answers or a withdrawal without its reason fails validation. Activity dated after `recordedAt` fails too. Server-side shapes the API already validates (form schema, cohort expression, update blocks) stay `unknown`, so there is one validator for each.

The agent writes the files and the importer only reads them, so YAML is parsed with Bun's built-in `Bun.YAML` and no YAML dependency is needed. Since JSON is valid YAML, either form works.

The files never record contract signing. On import, every participant without an active contract signs as they act, which is what the skills do live.

## Importer

`scripts/import-fakes.ts` goes through the API for the same reasons the skills do. It uses SQL only for lookups and for backdating, which is the part the API can't do.

**Ordering.** Events that already ended the member phase are added after participants and updates (`splitEvents`). Otherwise the server would reject submissions on an action that is closed by the time of import.

**Backdating.** These columns are set to their shifted times:

- `action_activity.createdAt`;
- `form_response.createdAt`;
- `action_update.date` and `visibleAt`.

Contract events keep the import time. A backdated signing could land before a later suspension and leave the member's contract inactive.

**Idempotency.** A rerun on a database that wasn't cleared changes nothing:

- a `fake` file whose action name exists is skipped;
- a member who already has activity on the action is skipped, not replaced;
- an event is skipped when one with the same title and status exists;
- an update is skipped when one with the same title exists.

**Stand-ins.** A missing or ineligible member is replaced by a random member from the action's cohort who hasn't acted on it. Members with an active contract are preferred, as in the skill. In testing, a stand-in without a contract made the server announce the signing to that member's group, creating 24 in-app "joined" notifications. None were pushed.

**Failures.** One member or file failing doesn't stop the rest. Every failure is printed at the end and the script exits 1.

## Shared helpers

The importer and `mint-token.ts` both need tokens, so minting moved into `scripts/lib/access-token.ts`. `mint-token.ts` is now a thin CLI over it. Signing uses `@nestjs/jwt`, which the server declares, rather than the undeclared transitive `jsonwebtoken`.

`scripts/lib/local-db.ts` gained `execLocalDb` for writes, because Postgres refuses data-modifying statements inside the subquery that `queryLocalDb` wraps. Both share one `psql` invocation, which now stops on the first error.

## Round trip

The importer was tested against the local db:

- **Fake file:** a copy of action 174's real data under a new name, with a project, a closed member phase, an update, and a participant id that doesn't exist. It came back as action 176 with the project, events, 13 activities, 12 form responses and the update, all at their shifted times. The missing member got a stand-in.
- **Staging file:** a wrap-up on action 162, matched by name.
- **Missing-action file:** skipped with a note.
- **Rerun:** a second import skipped everything.

A cold agent then ran the whole loop: it created live action 178 in a new project, recorded engagement on it, soft-deleted the action and project, and imported. Action 179 came back with:

- the same fields and project;
- events shifted to land on import;
- 5 completions, 1 withdrawal and 1 dismissal, with identical answers and device types;
- the update.

A second import skipped it. What the agent flagged led to these changes:

- the withdrawal flags and free-text `reason`;
- `deviceType` limited to the server's values;
- defined `at` and `recordedAt` times;
- the snapshot join and the false booleans spelled out.

## Modifying actions

No admin route edits an existing event, so `scripts/shift-action.ts` moves an action with one SQL transaction. It shifts `action_event.date`, `action_activity.createdAt`, the linked `form_response.createdAt`, the `action_update` dates, and `action_cohort_decision.resolvedAt`. Refusals:

- A move that would put existing activity in the future is refused.
- Suite actions are refused. `syncGeneralUpdateDatesForSuites` runs only on API mutations, so a SQL move would leave the suite's general-update dates stale. The suite routes (`batchUpdateSuiteEvents`) keep them in step.

Some derived state isn't refreshed after a move:

- `usersJoined` is recomputed by its worker within 10 minutes.
- Existing cohort decisions keep their verdicts, which is what a moved history means.
- `computedAutocompleteAt` applies only to forum-participation actions.

**Engagement on a past action.** The server refuses completions after the deadline (`computeCompletionBlock`), and cohort enrollment closes there too. So engagement isn't written into the past directly:

1. `--live` shifts the action as late as its existing activity allows, which opens the member phase now.
2. `/fake-engagement` runs normally.
3. The final move carries everything to the requested date.
4. `--spread` re-times the action's activity at random across its member phase.

`--spread-after <activityId>` re-times only activity added after that id, so older activity keeps its times and the new members don't cluster at the launch.

`--live` deletes the action's `resolved_after_deadline` decisions: exclusions made only because the phase had closed. They are deleted rather than soft-deleted. The unique `(actionId, userId)` index covers soft-deleted rows and the server inserts with `orIgnore`, so a soft-deleted exclusion silently blocks the member feed's fresh decision.

A cold agent ran `/modify-action move 176 to 3 weeks ago and populate it with engagement`. It moved the launch 21 days back and added 22 members' engagement and an update, and every activity row landed inside the member phase. It also showed that 207 stale exclusions survived `--live` and covered every new participant. With the deletion fix, re-running the open–feed–move sequence on 176 gave all 19 new members with activity an included `launch` decision.

**Recording.** `--record` rewrites a file's dates from the db: events matched by title and status, participants by user, updates by title. Anything without a db row moves by the same delta. `recordedAt` becomes now, so an import keeps the moved timeline in place rather than re-anchoring it.

**Asking.** The skill asks only what the code and the action can't settle. The recording question is asked on every run, as required. The recommended answer is to record when the action already has a file, and db-only otherwise. Deleting is confirmed first, with archiving as the recommended alternative.

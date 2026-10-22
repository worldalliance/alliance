---
name: fake-engagement
description: Read before populating local actions with fake engagement — members completing, withdrawing, or dismissing, staff updates, and closing old actions.
---

# Fake engagement

Each run plays the members and staff of existing local actions. Activity accumulates across runs. Follow the Conventions and Server sections of `(root)/skills/fake-action/SKILL.md`, then the steps below.

`SEND_DEV_NOTIFS` must be unset, both in `server/.env` and in the running server's environment. Signing contracts and posting updates can notify members, and the server delivers locally only with that flag set.

## 1. Target

Use the action id the invoker gave. Without one, pick the live action (status now `member_action`) with the fewest `action_activity` rows.

Read its body and form so the cast's answers fit it. `GET /tasks/slug/:formId` returns the form with its `formSnapshotId`. A form with `variables` resolves them per member, so read each member's values before writing their answers: `resolveVariableValues` in `common/src/forms/variable-evaluation.ts`, seeded by `formRandomizationKey` in `shared/formrenderer.ts`.

## 2. Members

Skip this step when the target's status now isn't `member_action`.

Pick a believable cast, a different size and mix each run, from users who:

- are in the target's cohort: `POST /actions/evaluate-cohort` with its `cohortExpression`;
- have no `action_activity` on the target;
- are not `admin`, `anonymous` or `isTestUser`.

Draw participants in this order, moving on only when you need more:

1. Users with an active contract: their latest non-deleted `contract_event` dated up to now (ties broken by highest `id`) is `signed`.
2. Users whose contract is suspended: re-sign as the member.
3. Users who never signed: sign as the member.

To sign, get the current contract from `GET /contract/current`, then `POST /contract/sign/:id` with the member's own name.

Every cast member fetches `GET /actions/loggedIn`, including those who will do nothing. That fetch writes their `action_cohort_decision`. Then they act in character:

- most complete it with `POST /tasks/submitForm/:formId` and `{answers, actionId, deviceType, formSnapshotId}`, with answers that sound like that person;
- a few withdraw with `POST /tasks/optout/:formId` and `{actionId, reason, outOfTime, isMoral, partialFormData}`. `reason` is one of `WITHDRAWAL_OPTIONS` in `common/src/actionActivity.ts`, and `partialFormData` is the same body as a submit, with `answers: {}`;
- a few dismiss with `POST /actions/dismiss/:id`.

Everyone else in the cast does nothing.

Done when `action_activity` for the action holds the outcome you planned for every participant.

## 3. Updates

An update takes two calls:

1. `POST /actions/createUpdate/:id` with `{title, date, shortNotifString, notifyType: "none"}`. `notifyType: "none"` keeps anything from being queued to send. This creates it empty and invisible.
2. `PATCH /actions/updateUpdate/:updateId` with `{schema: {blocks}, expectedSchemaSnapshotId}`, taking the snapshot id from the create response. Writing the body publishes it. Block shapes are in `common/src/forms/display-only-schema.ts`.

- A live target sometimes gets 0–2 mid-action updates: progress, a milestone, a wrinkle.
- Some runs, as you judge it, also do one or both of these:
  - Close an open action: its status now is `member_action`, which began more than 3 days ago, and it is neither `onboarding` nor in a suite. Onboarding actions gate the local signup flow, and suites schedule their own events. To close it, add an `office_action` event dated now with `?acknowledgeDeadlineShortening=true`.
  - Post a wrap-up on a closed action (status now `office_action` or later) that has no update yet, telling members what their work went towards.

Done when every update you posted has a `visibleAt`.

## 4. Report

Report:

- the target's admin URL: `http://localhost:<admin port>/actions/<id>`;
- this run's participant counts by outcome;
- contracts signed or re-signed;
- updates posted and actions closed.

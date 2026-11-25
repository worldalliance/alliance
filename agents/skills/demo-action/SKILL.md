---
name: demo-action
description: Read before creating a demo action in the local staging database and deploying it to every member, or writing an HTML page of directions for a staff member to create one by hand in the local admin.
---

# Demo action

Each run invents one action and launches it to the whole Alliance through the local admin API. It stops there; `(root)/agents/skills/demo-engagement/SKILL.md` adds members' activity.

A prompt asking for an HTML page, such as `html page: an environment action with a narrow cohort that launches tomorrow at 7pm`, runs **HTML-page mode** instead.

## Conventions

Shared with `demo-engagement`.

These skills are for staging data only: they write to the local db, which no member ever sees, so write without asking first and report afterward. Content is realistic, inventive, and now and then funny: believable Alliance work, written by someone who enjoys the job.

Everything goes through the API so the server's validation and side effects run. `GET /openapi.yaml` gives request bodies, but it marks some required fields optional; the bodies these skills name are the ones the server actually demands. Calls run as a user with a token from `(cd server && ../scripts/with-secrets.sh server bun ../agents/skills/playwright/mint-token.ts <userId>)`: admin calls as any `admin = true` user, member calls as that member. Queries follow `(root)/agents/skills/local-db/SKILL.md`. An action's status now is its latest `action_event` dated up to now (ignoring deleted ones), and that status began on that event's date. Logs go in `.scratch/`. When a step needs a script, such as listing past actions or printing a form as text, reuse one from `.scratch/demo/` or write it there when none exists.

## 1. Server

`./scripts/with-env.sh` prints the API port. If nothing listens there, start `bun run server:dev` from the repo root in the background; it loads the server's secrets and this checkout's ports.

`SEND_DEV_NOTIFS` must be unset, both in `server/.env` and in the running server's environment (`ps eww` on the listening pid). Signing contracts and posting updates can notify members, and the server delivers locally only with that flag set.

Done when `/openapi.yaml` responds.

## 2. Topic

Ground the action in the Alliance:

- `apps/frontend/src/lib/alliancePriorities.tsx`: the four focus areas.
- `apps/frontend/src/site/docContent.ts`: what kinds of actions the Alliance runs.
- Past actions in the db: those with a `member_action` event were released, and an action's form is `form_snapshot.schema` through `action."taskFormId"` and `form."formSnapshotId"`. Read enough to match their voice and to know which topics are taken.

Done when you have a topic no past action covers, its categories (`ActionCategory` in `server/src/actions/action-category.ts`), and a one-line reason it fits a focus area.

## 3. Action

1. Write the form and `POST /tasks/createForm` with `{title, schema}`. Every action has one. The schema is `formSchema` in `common/src/forms/form-schema.ts`; model it on a past snapshot's JSON, joined by `form."formSnapshotId"`. Its fields collect what the action would actually need from members.
2. `POST /actions/create` with `name`, `taskFormId`, a markdown `body`, `shortDescription`, `category`, `timeEstimate`, `cohortExpression: {"type":"AllMembers"}`, and `visibilityMode: "all_members"`, and `isContractSigningAction`, `onboarding`, `optional`, `preventCompletion`, `publicOnly`, `shouldCompleteAfterDeadline` and `isForumParticipationAction` set to false.
3. Pick the state, varying it between runs, and add events with `POST /actions/:id/events`:
   - **live**: `member_action` dated now, then `office_action` at a deadline days to weeks out;
   - **planned**: `planned` dated now, then `member_action` in the future and a later `office_action`.
4. Some runs start a project with this action as its first step: `POST /projects` with `{name}`, then `PATCH /projects/:id` with `{category}`. Others add it as the next step of an existing project from `GET /projects`. Many actions stay standalone. Assign with `PUT /projects/actions/:actionId` and `{projectId}`.

Done when `GET /actions/adminslug/:id` returns the action with its `taskFormId` and events.

## 4. Report

Report:

- the action's admin URL: `http://localhost:<admin port>/actions/<id>`;
- its state, topic and project.

## HTML-page mode

The run writes a page of numbered directions a staff member follows by hand in the local admin to create the action the prompt describes: its form, the action, its cohort and its scheduled release. It writes nothing to the database, since the person following the page creates everything; reads are fine. The prompt sets what it names, such as topic, cohort and launch time, and the run invents the rest as steps 2 and 3 do. Counting the cohort requires an already-running local API at this checkout's port. Do not run step 1's server startup: application bootstrap writes to the database. If the API is unavailable, report that prerequisite and stop without a page.

- **Path.** Start from the Actions page's Create menu (`apps/admin/src/components/CreateActionMenu.tsx`, its New Action item opening `ActionDashboard.tsx` with its tabs), unless the prompt asks for a project or a suite, in which case follow that path in `apps/admin/src/routes.ts`.
- **Accuracy.** Derive every step from the admin source on this run, not from memory or an earlier page: the route, tab, button and field labels as the code renders them, the order the UI lets things happen in, and what it demands before a step works, such as a saved action before its form or events. The page is wrong the moment it names a control that isn't there, so quote labels exactly.
- **Cohort.** A narrow cohort fits the topic and uses only tags, actions and form answers that exist in the local db, so it matches real members. Build it in the terms `CohortExpressionBuilder.tsx` shows and state how many members it matches, counted with `POST /actions/evaluate-cohort` and `{expression}`, which writes nothing; completions live outside `user_action`, so a hand-written query undercounts.
- **Times.** Times the prompt gives are Pacific. Some admin date inputs, such as the action's Event Management tab, take the browser's own zone and say so in their label, so write each time in the zone its input takes, with Pacific beside it when they differ. A request the selected admin path can't express ends the run with the reason and no page.
- **Copy.** Every piece of content the person enters, the name, short description, markdown body and each form field, has a one-click copy button.
- **Output.** One self-contained file, inline CSS and JS and no network requests, at `.scratch/demo/pages/<slug>.html`. Open it in the browser pane, then report its path, the topic, the cohort and its member count, and the launch time.

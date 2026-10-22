---
name: fake-action
description: Read before creating a fake action in the local database and deploying it to every member.
---

# Fake action

Each run invents one action and launches it to the whole Alliance through the local admin API. It stops there; `(root)/skills/fake-engagement/SKILL.md` adds members' activity.

## Conventions

Shared with `fake-engagement`.

The local db is internal staging data that no member ever sees, so write without asking first and report afterward. Content is realistic, inventive, and now and then funny: believable Alliance work, written by someone who enjoys the job.

Everything goes through the API so the server's validation and side effects run. `GET /openapi.yaml` gives request bodies, but it marks some required fields optional; the bodies these skills name are the ones the server actually demands. Calls run as a user with a token from `bun skills/fake-action/mint-token.ts <userId>`: admin calls as any `admin = true` user, member calls as that member. Queries follow `(root)/skills/local-db/SKILL.md`. An action's status now is its latest `action_event` dated up to now (ignoring deleted ones), and that status began on that event's date. Scripts and logs go in `.scratch/`.

## 1. Server

`./scripts/with-env.sh` prints the API port. If nothing listens there, start `bun --watch src/main.ts` in `server/` in the background.

Done when `/openapi.yaml` responds.

## 2. Topic

Ground the action in the Alliance:

- `apps/frontend/src/lib/alliancePriorities.tsx`: the four focus areas.
- `apps/frontend/src/site/docContent.ts`: what kinds of actions the Alliance runs.
- Past actions in the db: `bun scripts/list-actions.ts` lists every released action, and `bun scripts/get-action-form.ts <id>` prints one's forms as text. Read enough to match their voice and to know which topics are taken.

Done when you have a topic no past action covers, its categories (`ActionCategory` in `server/src/actions/action-category.ts`), and a one-line reason it fits a focus area.

## 3. Action

1. Write the form and `POST /tasks/createForm` with `{title, schema}`. Every action has one. The schema is `formSchema` in `common/src/forms/form-schema.ts`; model it on a past `form_snapshot` row's JSON. Its fields collect what the action would actually need from members.
2. `POST /actions/create` with `name`, `taskFormId`, a markdown `body`, `shortDescription`, `category`, `timeEstimate`, `cohortExpression: {"type":"AllMembers"}`, and `visibilityMode: "all_members"`, and every remaining boolean the DTO requires set to false.
3. Pick the state, varying it between runs, and add events with `POST /actions/:id/events`:
   - **live**: `member_action` dated now, then `office_action` at a deadline days to weeks out;
   - **planned**: `planned` dated now, then `member_action` in the future and a later `office_action`.

Done when `GET /actions/adminslug/:id` returns the action with its `taskFormId` and events.

## 4. Report

Report:

- the action's admin URL: `http://localhost:<admin port>/actions/<id>`;
- its state and topic.

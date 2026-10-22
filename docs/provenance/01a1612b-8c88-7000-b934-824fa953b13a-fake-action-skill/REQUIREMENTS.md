---
user: Alex Dorey
task: Write two skills, one that has an agent create a new action in the local database and deploy it to the full Alliance audience, and one that populates actions with simulated engagement
---

## User-origin requirements

- A `SKILL.md` for an agent that writes a new action to the local database and deploys it to the full Alliance audience.
- The agent draws on its knowledge of the Alliance Foundation, the codebase, and the history of past actions.
- The actions populate the local database with realistic activity that only staff see internally. They are never used for real.
- The agent gets creative, and occasionally adds humor.
- The scope is split into two skills:
  - `/fake-action` creates and launches an action;
  - `/fake-engagement` populates actions with engagement.
- To get enough participants, the agent:
  - uses users who already have an active contract first;
  - re-signs contracts that have been suspended, as needed;
  - signs contracts for users who have none, as needed.
- The local data is all staging data. A run may optionally close any action that has been open for more than 3 days.
- A run may post a wrap-up update on a closed action, telling members what their work went towards.
- When the local API server isn't running, the agent starts it in the background and continues.

## Agent-proposed, user-approved

### Invocation and naming

- The skills are `skills/fake-action/SKILL.md` and `skills/fake-engagement/SKILL.md`.
- The model can invoke both, and so can the user as `/fake-action` and `/fake-engagement`. Each `description` triggers on its own kind of request: creating a fake action locally, or populating actions with fake engagement. A one-line pointer for each in the root `AGENTS.md` names it.
- `/fake-action` stops once the action is created and launched. It does not go on to create engagement.

### Content

- The agent always picks the topic itself. The invoker does not supply a brief.
- The agent writes directly to the local database, without showing a draft for approval first. It reports what it created afterwards.
- Each run creates exactly one action.
- Every action has a task form, meaning a form with fields that members fill in.
- The action sets one or more categories (`environment`, `poverty`, `democracy`, `technology`, `meta`) that fit its topic, and a time estimate.
- Alliance knowledge comes from repository files: `apps/frontend/src/lib/alliancePriorities.tsx` and `apps/frontend/src/site/docContent.ts`. Past actions in the local database inform the voice and keep topics from repeating. The agent reads them with the existing `scripts/list-actions.ts` and `scripts/get-action-form.ts`.

### Audience and lifecycle

- The agent writes through the local admin API, not raw SQL. Rows reach the local database through the server's own validation:
  - `POST /actions/create` creates the action;
  - `POST /actions/:id/events` adds its events.
- The full audience is cohort expression `{"type":"AllMembers"}`.
- The agent varies the new action's state between runs, choosing only between two:
  - **live**: a `member_action` event dated now, then a deadline event later;
  - **planned**: the action is scheduled to start in the future.

  New actions are never created already past their deadline or closed.

- No reminder groups are created, so no notifications get queued.

### Member simulation (`/fake-engagement`)

- `/fake-engagement` populates the action whose id the invoker gives. Without an id, the agent picks a live action, preferring ones with little activity.
- It can run repeatedly on the same action. Each run casts only members who haven't acted on that action yet, so activity accumulates.

- Members are simulated as themselves. The agent mints a JWT for each participating local user and submits the task form through the member endpoint, with in-character answers. Form responses and completions land the same way real ones do.
- Contract signing and re-signing also go through the member's own authenticated API calls.
- The agent picks a believable mix of outcomes that varies by action:
  - some members complete;
  - a few choose won't-complete or dismiss;
  - the rest do nothing.
- Planned actions get no activity.

### Action updates (`/fake-engagement`)

- Live actions sometimes get 0–2 mid-action updates.
- Some runs, at the agent's discretion, do either or both of the following, so the database builds up a natural mix:
  - close one action that has been open for more than 3 days;
  - post a wrap-up update on an already-closed action that lacks one, saying what members' work went towards.

### Tooling

- A reusable token-minting script, `skills/fake-action/mint-token.ts <userId>`, prints a JWT. Both skills use it, and the agent makes its own API calls with the token. The `playwright` skill is unchanged.

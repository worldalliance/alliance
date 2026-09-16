---
user: Alex Dorey
task: Improve /tasks page load time
---

## Task

> i am tasked with improving the pageload time for the `/tasks` page. Analyze the page load of https://staging.thealliance.org/tasks ([credentials redacted]) and give an assessment of what the slower steps are and a list of places to improve. Do not make any code changes yet

## Scope of this change

After the agent presented a ranked list of improvements, the user selected one:

> yes, start with the `Promise.all` change

The agent's proposal that this refers to: replace the sequential `for (const action of actions) { await this.userCanSeeAction(...) }` loop in `ActionsService.findMemberPublic` with parallel resolution, so 91 iterations stop serializing on the event loop.

## Constraints stated by the user

- No code changes until explicitly asked (lifted by the instruction above, scoped to this one change).
- Earlier in the task the user asked for a way to measure the improvement locally, and the agent built one; the user did not specify the tool or metric.

## Environment facts supplied by the user

- The user logged in manually in a headed Chromium so the agent could reuse the session; the agent does not enter passwords.

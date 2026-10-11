---
user: Charles Lien
task: One rule for whether a member already submitted an action's form, and no new variant for a member who already submitted
---

## Requirements

- Duplicated code is consolidated where the copies should change together, so a later change applies to every copy and behavior cannot diverge. (user-originated)
- "A member has already submitted an action" means the member has a response to any of the action's forms: its task form or any of its variants' forms. One server implementation of that rule serves every read of it. (agent-proposed, user-approved)
- Form submission (`POST /tasks/submitForm/:id`) and draft saving (`PUT /tasks/formDraft/:id`) both refuse a member who has already submitted the action with 400 `"Form already submitted"`. (agent-proposed, user-approved)
- The linked-guest draft prefill (`GET /tasks/draft/:id`) takes the action's id as a required `actionId` query parameter, and returns no draft for a member who has already submitted that action. The web client passes it. (agent-proposed, user-approved)
- A member who has already submitted an action, and has no form-variant assignment for it, is assigned the variant whose form they submitted; a submission to the task form assigns the default (no variant). The assignment is stored like any other and stays fixed. Both the single-action and the batch assignment paths follow this. (agent-proposed, user-approved)
- A one-time data migration points every existing assignment of a member who submitted an action's task form at the default, so those members are no longer stuck on a variant they cannot submit. (agent-proposed, user-approved)
- Guest submissions (`submitFormPublic`) keep their own per-guest check, out of scope. (agent-proposed, user-approved)
- Each behavior change is reproduced by a failing test before the fix. (agent-proposed, user-approved)
- Minimal standalone commits. (user-originated)

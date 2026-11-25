---
user: Alex Dorey
task: Add a persona for an active Alliance member who is assigned an action, brought to the Kora interface, given about 15 minutes of reviews, and then offered the option to keep reviewing
---

## Persona: `docs/personas/active-member-kora-reviewer.md`

- Ana, a synthetic name: an active Alliance member who does most of her assigned actions. (agent-proposed, user-approved)
- Context: uses the mobile app in short gaps, like a commute or lunch break. Comfortable with apps. (agent-proposed, user-approved)
- Access needs: none. (agent-proposed, user-approved)
- Concerns: whether her work counts. (agent-proposed, user-approved)

## Scenario: `docs/scenarios/member-kora-review-action.md`

- An active member is assigned an action, brought to the Kora interface, and given about 15 minutes of transcripts to review, then given the option to continue reviewing. (user)
- The trigger is a push notification that she has a new action, which opens the action in the app. (agent-proposed, user-approved)
- The Kora interface is a slight variation of the shared review interface that non-member participants use. (user)
- The member variation needs no separate sign-in, because her member session carries over. (agent-proposed, user-approved)
- Finishing the assigned batch completes the action and returns her to the action's "Task complete" card. (agent-proposed, user-approved)
- The action's "Task complete" card tells her how she can continue reviewing chat transcripts, which is optional. (user)
- Extra reviews come after the action is already complete. Each one saves as she submits it and adds to a running count she can see, and she can stop at any time without losing anything. (agent-proposed, user-approved)

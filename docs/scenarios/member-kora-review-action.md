---
personas: [active-member-kora-reviewer]
---

# Do my Kora review action, then keep going if I have time

Partly unbuilt: the member variation of the shared Kora review interface, its link from the action, and the option to keep reviewing exist in no code yet. The action screen exists.

- **Trigger**: a push notification that she has a new action
- **Starting point**: signed in to the mobile app as a member, assigned the Kora review action

## Journey

1. Action screen (`/actions/:id`, `apps/mobile/app/(app)/actions/[id]/index.tsx`, `apps/mobile/components/TaskTimeInfo.tsx`): she taps the notification and lands on the action, which shows its time estimate of about 15 minutes. She starts the task.
2. Kora review interface, member variation (unbuilt): it opens with her member session, with no separate sign-in, and gives her a batch of transcripts sized to about 15 minutes. She reads and rates each one.
3. Task complete (unbuilt in this form): finishing the batch completes the action and returns her to the action's "Task complete" card. The card tells her she can keep reviewing chat transcripts if she wants to.
4. Extra reviews (unbuilt): she chooses to continue. Each extra review saves as she submits it and adds to a running count she can see. She can stop at any time without losing anything.

**Done when**: the action shows as complete, and if she kept going, she can see how many extra reviews she has done.

## Where it goes wrong

- The action is slow to load: "Loading action details..."
- The action fails to load: "Could not load action", with a "Go Back" button

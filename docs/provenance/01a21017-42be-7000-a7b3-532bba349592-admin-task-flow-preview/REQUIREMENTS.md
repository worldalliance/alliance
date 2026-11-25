---
user: markzxu
task: Make the admin preview button give staff the same task completion experience members get
---

- "make the admin preview button be the same task completion experience as members get": staff previewing a task form from the admin go through the members' task panel and steps, submit the form, and see the completed state members see afterwards. (user-originated)
- Nothing in the preview is saved: no response, no completion, no notification, and no analytics recorded as a real member. Submitting in preview reaches no write endpoint, and a test proves it. Staff can start over after finishing. (user-originated)
- The preview's existing controls keep working: preview as member, the visibility profile picker, and the row picker. (user-originated)
- The members' task flow (`apps/frontend/src/components/taskflow/` and what it needs) moves into `sharedweb` behind a small host interface. The frontend keeps its current behaviour through that interface, with its tests moved alongside, and the members' flow does not change visibly. (agent-proposed, user-approved)
- The admin's Preview, in the form builder and in the suite launch's "Preview task form as this member" link, renders that flow in its staff preview mode (`TaskFlowMode.Preview`) for the chosen member and row. Preview as member, the visibility profile picker, the row picker and unsaved form edits keep working. Where the form builder has no action, the flow uses a stand-in action. (agent-proposed, user-approved)
- The full-screen flow fills the screen below the admin's top bar, the way it sits below the member nav. (agent-proposed, user-approved)
- The completion screen shows "View tasks" and "Invite a friend" with the members' labels. In preview, both just close the flow. (agent-proposed, user-approved)
- After the completion screen closes, the preview shows the members' completed card built from the preview's answers, plus a "Start over" button that clears everything and returns to the start card. (agent-proposed, user-approved)
- The completed card's "Share" button is hidden in preview. (agent-proposed, user-approved)
- A task form opened directly at `/forms/:id`, such as through "Edit task form", also previews through the task flow. The forms API says whether a form is a task form, and the form builder uses that to pick the task flow preview. (agent-proposed, user-approved)

---
user: markzxu
task: Do an ambitious redesign of the admin panel, which is super cluttered visually, very unclear about what is happening, with things in terrible places and organized terribly. This PR is the merged action workspace.
---

# Requirements

This task is PR 2 of phase 1 of the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell`, which holds the redesign's full requirements. The entries below restate the ones this PR carries out, as they apply to the action workspace.

1. The project action page (`/projects/:projectId/action/:actionId`) and the action dashboard (`/actions/:actionId`) merge into one action workspace at `/actions/:actionId`, reached from both projects and actions, with about four tabs: overview, content, members/responses and communications. (agent-proposed, user-approved)
2. Visual direction: a quiet, dense, neutral tool in the style of Linear or Vercel, with one accent colour and colour reserved for status. (agent-proposed, user-approved)
3. Ambitious redesign of the action page: less visual clutter, clear about what is happening, and things in sensible places and organisation. (user-originated)
4. The editor's Staff preview checkbox is shown for actions outside a project and for scheduled or live actions; otherwise the Overview's staff testing control is the only one. (agent-proposed, user-approved)
5. On an action outside a project, "Start staff testing" is not blocked by the four staff testing requirements (a short description, full body content, a linked task form and a cohort expression); on a project action it is. (agent-proposed, user-approved)
6. Live states, such as the Member action status and the Live phase, take their own status tone, the admin's blue, distinct from the green that stays for Completed and Signed. (agent-proposed, user-approved)

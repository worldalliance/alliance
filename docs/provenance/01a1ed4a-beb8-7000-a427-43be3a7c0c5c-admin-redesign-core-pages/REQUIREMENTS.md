---
user: markzxu
task: Do an ambitious redesign of the admin panel, which is super cluttered visually, very unclear about what is happening, with things in terrible places and organized terribly.
---

# Requirements

This is PR 3 of the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell`: the projects pages, the actions list and Stats move onto the shared layout primitives.

1. Ambitious redesign of the admin panel (`apps/admin`): less visual clutter, clear about what is happening, and things in sensible places and organisation. (plan requirement 1; user-originated)
2. Phasing: phase 1 covers the shared layout primitives, the shell and navigation, and the core flow (projects, actions, the action workspace, members, Stats). The remaining pages move onto the primitives in later phases. Each phase is reviewable on its own. (plan requirement 2; agent-proposed, user-approved)
3. Stats stays the home page (`/`) and is cleaned up. (plan requirement 4; agent-proposed, user-approved)
4. Visual direction: a quiet, dense, neutral tool in the style of Linear or Vercel, with one accent colour and colour reserved for status. (plan requirement 6; agent-proposed, user-approved)
5. The project cards don't show the mini-timeline; the project page does. (agent-proposed, user-approved)
6. Stats loads its reports on open. (agent-proposed, user-approved)
7. Actions keeps the in-progress suites panel of `01a1812f-9204-7000-9d4f-efb13a967392-suite-launch-flow` (its requirements on "Suites with draft or active actions"), adapted to the redesign: a collapsible "In-progress suites" section above the list, showing each suite with at least one draft or active action, its draft and active counts, and a link to each of those actions. (agent-proposed, user-approved)

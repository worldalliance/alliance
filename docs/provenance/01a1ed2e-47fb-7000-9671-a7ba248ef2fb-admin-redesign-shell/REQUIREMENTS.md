---
user: markzxu
task: Do an ambitious redesign of the admin panel, which is super cluttered visually, very unclear about what is happening, with things in terrible places and organized terribly.
---

# Requirements

1. Ambitious redesign of the admin panel (`apps/admin`): less visual clutter, clear about what is happening, and things in sensible places and organisation. (user-originated)
2. Phasing: phase 1 covers the shared layout primitives, the shell and navigation, and the core flow (projects, actions, the action workspace, members, Stats). The remaining pages move onto the primitives in later phases. Each phase is reviewable on its own. (agent-proposed, user-approved)
3. The project action page (`/projects/:projectId/action/:actionId`) and the action dashboard (`/actions/:actionId`) merge into one action workspace at `/actions/:actionId`, reached from both projects and actions, with about four tabs (overview, content, members/responses, communications). (agent-proposed, user-approved)
4. Stats stays the home page (`/`) and is cleaned up. (agent-proposed, user-approved)
5. Navigation: about five always-open sidebar sections (for example Work, People, Growth, Content, Insights), with sentence-case labels and attention counts. Rarely used pages are left out of the main section links, reached through the ⌘K search and through a dropdown in their section instead of collapsible folders. This supersedes the folder layout, collapsible folders and remembered open folders in `01a0d01b-2adf-7000-88f2-29de64dd3166-admin-actions-filter-and-sidebar-folders`, and the Links folder in `01a11d2e-3188-7000-a475-cbe52fe553a8-custom-links`. (agent-proposed, user-approved)
6. Visual direction: a quiet, dense, neutral tool in the style of Linear or Vercel, with one accent colour and colour reserved for status. (agent-proposed, user-approved)
7. Each sidebar section has a dropdown listing its pages that are otherwise reached only through search. (user-originated)
8. The phase 1 PRs after the first are carried out by subagents. (user-originated)

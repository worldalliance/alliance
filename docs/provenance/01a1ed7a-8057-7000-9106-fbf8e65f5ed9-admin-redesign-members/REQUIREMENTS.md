---
user: markzxu
task: Do an ambitious redesign of the admin panel, which is super cluttered visually, very unclear about what is happening, with things in terrible places and organized terribly.
---

# Requirements

This is PR 4 of the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell`: the members list and the member page move onto the shared layout primitives.

1. Ambitious redesign of the admin panel (`apps/admin`): less visual clutter, clear about what is happening, and things in sensible places and organisation. (plan requirement 1; user-originated)
2. Phasing: phase 1 covers the shared layout primitives, the shell and navigation, and the core flow (projects, actions, the action workspace, members, Stats). The remaining pages move onto the primitives in later phases. Each phase is reviewable on its own. (plan requirement 2; agent-proposed, user-approved)
3. Visual direction: a quiet, dense, neutral tool in the style of Linear or Vercel, with one accent colour and colour reserved for status. (plan requirement 6; agent-proposed, user-approved)
4. The member page opens on its Profile view by default. (agent-proposed, user-approved)
5. The members list's filter bar has a "Clear all" that returns its filters to the page's defaults: it clears the search and the role, tag and action progress filters and returns the contract filter to Signed only, keeping the List/Grid view. (agent-proposed, user-approved)

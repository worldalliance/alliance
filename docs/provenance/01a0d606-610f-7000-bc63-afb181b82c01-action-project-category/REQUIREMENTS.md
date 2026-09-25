---
user: Alex Dorey
task: Tag actions and projects with an Alliance goal category
---

## User requirements

- Tag actions and projects with a category: which of the four Alliance goals (extreme poverty, environmental destruction, democratic institutional decline, dangerous technological development) they work towards.
- Convert the existing free-text `action.category` column to an enum (a list per action, since staff already tag some actions with several goals). The migration must be reversible; the original spellings do not need to survive a round trip.
- "Meta" (onboarding, governance, growth actions) is a fifth enum value, and may be combined with goals (agent proposed "Fifth enum value"; user selected it).
- Keep the column and enum name `category` / `ActionCategory`; rename admin's existing status-bucket `ActionCategory` instead (user selected among agent-proposed options).
- Legacy values: `all` → the four goals (not meta); `NA` and empty → no categories (agent-proposed mapping; user selected it).
- Projects store their own category too, as a list like actions, set independently (user selected among agent-proposed options).
- Admin only for now: tag in the admin UI, and show a small icon next to the action name, or next to the project name if a project is present, on the admin action overview.
- One icon per category when there are several, each with a tooltip/label (agent-proposed; user selected it).
- Icons (lucide-react): environment → Leaf, poverty → HandCoins, democracy → Landmark, technology → Cpu, meta → Users (agent-proposed; user selected it).
- Build against the current local database values; do not reload staging data.

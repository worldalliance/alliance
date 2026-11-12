---
user: Charles Lien
task: Open a PR for ALL-2144, replacing the remaining worldalliance.org text in content and tooling with thealliance.org.
---

# Requirements

Part of the plan in `docs/provenance/01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move/`.

- Replace worldalliance.org with thealliance.org in (user-approved, from ALL-2144):
  - the links in the early-action-learnings action post (`apps/frontend/src/action-posts/early-action-learnings.md`);
  - the reminder-link example in the admin reminder keyword help (`apps/admin/src/components/reminders/ReminderKeywordHelp.tsx`);
  - the URL text drawn by the brand image generators (`scripts/brand/og.py`, `scripts/brand/youtube.py`);
  - the link-preview User-Agent (`server/src/utils/safe-http.ts`);
  - the image URL on the landing test page (`apps/frontend/src/pages/static/LandingTestPage.tsx`).

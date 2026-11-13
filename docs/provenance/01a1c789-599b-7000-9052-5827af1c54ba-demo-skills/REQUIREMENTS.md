---
user: Alex Dorey
task: Copy the fake-engagement skill from the dorey/scratch branch as demo-engagement, and give it and the already-copied demo-action skill the same edits.
---

# Requirements

All user-originated.

- Copy only `skills/fake-engagement/SKILL.md` from the `dorey/scratch` branch into this repository, as `agents/skills/demo-engagement/SKILL.md`.
- In `demo-engagement` and `demo-action`, every mention of "fake" becomes "demo".
- Both skills state that they are used only for staging data.
- Both skills drop mentions of the uncommitted scripts (`scripts/list-actions.ts`, `scripts/get-action-form.ts`, `scripts/import-fakes.ts`, `scripts/generate-fake-images.ts`, `scripts/lib/fakes.ts`, `scripts/load_staging_data.sh`), and instead tell the agent to write a script when one it needs doesn't exist.
- Root `AGENTS.md` points to both skills, in wording that makes clear they are used only for staging data.

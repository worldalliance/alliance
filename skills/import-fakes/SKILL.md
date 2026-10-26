---
name: import-fakes
description: Read before restoring recorded fake actions, projects and engagement into the local database, as after `scripts/load_staging_data.sh` clears it.
---

# Import fakes

`/fake-action` and `/fake-engagement` record what they did in `.scratch/fakes/`. `scripts/import-fakes.ts` replays those files through the local API and shifts each file's dates so its latest recorded moment lands now.

1. Follow the Conventions and Server sections of `(root)/skills/fake-action/SKILL.md`.
2. `bun scripts/import-fakes.ts --check` validates every file. Fix a file it rejects using the error and `fakeFileSchema` in `scripts/lib/fakes.ts`.
3. `bun scripts/import-fakes.ts` imports. It is safe to rerun: fake actions that already exist, members who already acted, and events and updates already present are skipped.
4. `bun scripts/generate-fake-images.ts` re-attaches each fake action's thumbnail and cover image from `.scratch/fakes/thumbnails/` and `.scratch/fakes/covers/`, generating only the ones missing there.

Done when both exit 0. A non-zero exit lists each failed file or member with the API's answer.

Report each file's line from the output: the action it landed on, or why it was skipped. Include any members who stood in for recorded ones that are gone or out of the cohort.

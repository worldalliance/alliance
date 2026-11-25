# Decisions

All agent decisions.

- The Record step is dropped from `demo-engagement`, as it already was from `demo-action`: it existed to write files for the replay script, which the skills no longer mention.
- The instruction to write missing scripts sits once, in `demo-action`'s Conventions, which `demo-engagement` follows. Scripts go in `.scratch/demo/`, so a later run finds and reuses them.
- `./scripts/with-env.sh` stays in the Server step: it is committed, not one of the removed scripts.
- `demo-action`'s pointer to `demo-engagement` now uses the skill's real path, `(root)/agents/skills/demo-engagement/SKILL.md`.
- `demo-action/mint-token.ts` imported the removed `scripts/lib/access-token.ts`, so the token minting (JWT signed with `JWT_SECRET`, carrying the user's email and `sessionGeneration`) now lives in the skill's own file, reading the user row with `psql`.

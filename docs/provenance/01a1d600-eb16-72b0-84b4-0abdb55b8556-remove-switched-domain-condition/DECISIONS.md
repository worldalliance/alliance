# Decisions

Supersedes the `switchedDomainAt` ratchet and migration steps (ALL-2148, ALL-2149) planned in `docs/provenance/01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move/DECISIONS.md`.

- Skipping the ratchet and migration is safe because no stored schema has a `SwitchedDomainAt` condition (`EVIDENCE.md`, staging). Expand-migrate-contract protects data that exists; here the old shape has no instances. (agent decision)
- A condition naming `switchedDomainAt` saved in prod between the staging sync and the deploy would make that schema fail to parse after the deploy, a loud failure. Re-running the staging query on prod before the deploy rules it out. (agent decision)
- Dropping `switchedDomainAt` from the presence DTO needs no client release: clients read a missing key as unset and the generated client doesn't validate responses (`EVIDENCE.md`, readers). (agent decision)

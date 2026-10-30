# Decisions

- **Placement.** Root `AGENTS.md`, since the rule applies across every package. Steps are left out per the requirements, so a skill would carry nothing more.
- **Standard.** Expand-migrate-contract is the parallel change pattern: https://martinfowler.com/bliki/ParallelChange.html. It's common practice, not a formal standard.
- **`BACKCOMPAT(<tag>)` marker.** The one repo-specific convention in the rule, already used in `server/src/tasks/form.dto.ts`. It lets an agent find pending contract steps and check their conditions.

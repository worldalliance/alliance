# Decisions

- **Placement.** Root `AGENTS.md`, since the rule applies across every package. Steps are left out per the requirements, so a skill would carry nothing more.
- **Standard.** Expand-migrate-contract is the parallel change pattern: https://martinfowler.com/bliki/ParallelChange.html. It's common practice, not a formal standard.
- **`BACKCOMPAT(<tag>)` marker.** The one repo-specific convention in the rule, already used in `server/src/tasks/form.dto.ts`. It lets an agent find pending contract steps and check their conditions.
- **`useBackfillTimeZone` carries no `BACKCOMPAT` marker.** It isn't waiting on a contract step. Signup stores no zone when detection finds no valid one (`shared/lib/timeZone.ts`), so the hook is how those accounts get a zone. Its comment said to delete it once older accounts had a zone, which would have left those signups without one, so the comment now names the accounts it serves.

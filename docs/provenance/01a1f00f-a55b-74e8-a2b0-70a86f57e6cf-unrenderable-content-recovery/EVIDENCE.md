# Evidence

Checked 2026-11-18 by research subagents; categories per root `AGENTS.md` **Established practice**.

## Repository behaviour

Read 2026-11-18 at commit 94cc44094c.

- `variablesError` (`shared/useFormRenderer.ts`) carries both authoring errors and unknown-kind failures. The unknown-kind failures in the member path (`resolveFieldInput`, `resolveListInput` in `common/src/forms/variable-evaluation.ts`) read fields of this form's schema, whose unknown top-level kinds `findUnknownFormElementKind` already flags, and, through `resolveSourceInput`, fields of another form's submitted responses, though `readSourceHistory` (`common/src/forms/variable-source-history.ts`) drops questions of a kind this build doesn't know before evaluation reads them.
- `readDisplayOnlySchema` returns null for any parse failure, losing whether a block kind was unknown.
- `apps/frontend/src/lib/useFullLoadOnNewBuild.ts` already turns the next navigation into a full load once a new web build is deployed.
- `shared/useTaskFlow.ts` holds the task flow's open state in memory, so a web reload closes it.

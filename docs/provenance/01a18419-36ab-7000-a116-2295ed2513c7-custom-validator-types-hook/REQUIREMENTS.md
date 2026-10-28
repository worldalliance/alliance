---
user: Charles Lien
task: Move code that calls the generated API client directly behind a named TanStack Query hook that owns its cache
---

## User-origin requirements

- Everything that touches a cache lives in a single named hook.
- Find code that should go through a named TanStack Query hook but doesn't, such as an `sdk.gen.ts` function called directly or a raw `useQuery` call in a component, and complete one such hook. The hook shares one query cache and may cover several endpoints.
- Each change lands as a standalone commit.
- The migration ends in a fully reviewed pull request.

## Agent-selected target (not user-approved)

- `useCustomValidators` in `apps/admin/src/components/form-fields/useCustomValidators.ts` loads the validator types from `customValidatorCustomValidatorsAdmin` into a hand-rolled module-level cache, with `resetCustomValidatorsCache()` for tests to clear it. The validator types move into a TanStack query, keeping what the validator picker and the "Add rule" menu show while the types load, once they load, and when they fail.

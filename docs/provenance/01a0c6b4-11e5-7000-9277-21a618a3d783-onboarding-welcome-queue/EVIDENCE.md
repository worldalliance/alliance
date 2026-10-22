# Regression checks

Checks ran against `3db08edb3a3eb762412fdd2f26a4af5091bc60cc` with the review fixes in the `mark` worktree. Server integration tests use `alliance_mark_test`.

- Before implementation, `../scripts/with-env.sh bun test ./test/actions.e2e-spec.ts --timeout 60000 --test-name-pattern 'Welcome queue'` from `server/` exited 1 with three passing and four failing tests. The response omitted the required task count, a targeted task excluded a member outside its cohort, and the query returned a member with no applicable tasks.
- Before implementation, `../scripts/with-env.sh bun test ./test/actions.e2e-spec.ts --timeout 60000 --test-name-pattern 'keeps earlier members eligible'` from `server/` exited 1. Both members initially appeared; publishing another task returned no members instead of retaining the earlier member.
- An initial admin test command used `../../../.scratch/` from `apps/admin/` and exited 1 before running tests because that log directory did not exist. With the path corrected, `bun test src/pages/WelcomeQueuePage.test.tsx` from `apps/admin/` exited 1 with five passing tests and one failure. A zero task count rendered the ordinary empty queue instead of explaining the missing configuration.
- After implementation, the same welcome-queue integration command exited 0 with seven passing tests.
- `bun run gen-api` from the repo root exited 0 and regenerated the client from `http://localhost:3405/openapi.yaml`. The generated `WelcomeQueueDto` includes `requiredActionCount`.

# Standalone queue commit

Checks ran with the dashboard error-reporting changes removed from the working tree.

- `../scripts/with-env.sh bun test ./test/actions.e2e-spec.ts ./test/tasks.e2e-spec.ts --timeout 60000 --concurrency 1` from `server/` exited 0 with 180 passing tests. The suspension case uses a negated cohort to verify that inactive contract holders remain eligible. PostgreSQL emitted its existing concurrent-query deprecation warning during schema cleanup.
- `bun run test apps/admin` from the repo root exited 0 with 196 passing tests.
- `bun run typecheck` from `server/` and `apps/admin/` each exited 0. The admin check emitted the existing unspecified React version warning.
- `bun run format:check server/src/actions/actions.service.ts server/src/actions/actions.controller.ts server/src/actions/dto/action.dto.ts server/test/actions.e2e-spec.ts apps/admin/src/pages/WelcomeQueuePage.tsx apps/admin/src/pages/WelcomeQueuePage.test.tsx` from the repo root exited 0.
- `git diff --exit-code 3db08edb3 -- ':(glob)**/REQUIREMENTS.md'` and `git diff --check` from the repo root each exited 0. A regex scan of added lines and `.scratch/welcome-review-fixes/` found no private keys, JWTs, service tokens, or non-example email addresses.

# Withdrawal after completion

Checks ran against `10610cfcc6e4bfdd34b54828086304b4af915700` in the `mark` worktree. Server integration tests use `alliance_mark_test`.

- `createActivity` in `server/src/actions/actions.service.ts` rejects `USER_WONT_COMPLETE` only on contract-signing actions and rejects only a second activity of the same type.
- With the test `excludes a member who withdrew after completing and restores them after completing again` added and the query unchanged, `../scripts/with-env.sh bun test ./test/actions.e2e-spec.ts --timeout 60000 --test-name-pattern 'withdrew after completing'` from `server/` exited 1 with one failure. The queue returned the member who completed on 2020-01-01 and withdrew on 2020-01-02.
- With the query fix, `../scripts/with-env.sh bun test ./test/actions.e2e-spec.ts ./test/tasks.e2e-spec.ts --timeout 60000 --concurrency 1` from `server/` exited 0 with 181 passing tests.
- `bun run typecheck` from `server/` exited 0. `bun run format:check` on the four changed server files and `git diff --check` from the repo root each exited 0.

## Measurements

Method: from `shared/`, 40 concurrent `bun test lib/useCommunityMemberInfo.test.ts lib/useCommunityCompletedActionsCount.test.ts` runs per batch while four `yes > /dev/null` processes per core load the CPU. macOS, Bun 1.4.4, 2026-11-10.

- On `main` at `15e8be5dd2`: 4 failures in 40, all "refetches once the next member-action deadline passes" in `useCommunityMemberInfo.test.ts` with `Expected: 2, Received: 1`, the failure ALL-1968 reports.
- With both tests stubbing the clock: 0 failures in 120.
- Delaying the first response 200 ms in the mock handler: the tests on `main` fail in both files (member info with `Expected: 2, Received: 1`); the stubbed-clock tests pass.
- Waiting a further 300 ms after the second request: the stubbed-clock tests see no third request.
- With `useOnNextTimestamp` never calling `onPassed`, both stubbed-clock tests fail, so they still detect a hook that does not refetch at the deadline.

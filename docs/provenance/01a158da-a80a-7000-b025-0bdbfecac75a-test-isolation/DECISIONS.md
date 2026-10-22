## Order of teardown

Bun runs a test's `afterEach` hooks innermost first, so a file's hooks run before the preload's, except root-level ones in the first file to import `@testing-library/react`, where Testing Library's own auto-cleanup unmounts before them. `onTestFinished` callbacks run after all of them. `serveApi` restores the client in `onTestFinished`, so the preload's unmount happens while the test's routes still answer. A request a tree sends as it unmounts, or from an effect still pending when the test ends, reaches the mock rather than the network.

## No network between served tests

Once a test has given the page an http URL (`happyDOM.setURL`), the generated client's relative requests resolve against it and reach happy-dom's `fetch`, which tries a real connection and rejects with a `NetworkError` when it is refused. A sender that leaves that rejection uncaught fails whichever test is running when it lands. Deploy run 38857347641 failed that way, on a `MessagesPage.test.tsx` test that never sent the request: `MessagesPage`'s mark-read effect left its promise uncaught. The teardown order covers that case. Once a file has called `serveApi`, the generated client rejects with `UnservedRequest` at once outside its served tests, for the rest of the run and in every later file, naming the method and path, without trying the network. An uncaught one still fails the test it lands in.

Not done: failing the test that sent a late request. Once its test has ended, no test is left to charge it to. A late request that lands while a later test in the same file runs goes through that test's routes, and fails it with `UnroutedRequest` when none matches (ALL-1800).

## CommunityPage chat mark-read (ALL-1694)

The teardown order covers the CommunityPage chat tests' unawaited mark-read for every test, so no CommunityPage test changes for it.

## Same-timestamp completion and withdrawal (ALL-1659)

The test was right. `findLatestTerminalActivity` compared millisecond `Date`s while Postgres keeps microseconds, so two activities saved back to back could tie in JS and resolve in either order. It now breaks a tie by id, as `sqlIsLatestTerminalActivity` already did. The two still differ for rows saved in one millisecond whose microsecond order runs against their ids, which takes overlapping transactions; accepted. Every caller loads whole rows: TypeORM's `select` does not narrow the entity type, so a `select` that left out `id` would bring the tie back with no type error.

## Home feed fill seed rotation (ALL-1109)

Not applicable to `main`. The 30-minute seed rotation it describes existed only in commit f1a40f18f, which no branch contains now. `main` seeds the home feed fill by user id alone, with no clock.

## Per-file cleanup (ALL-1791)

Removing per-file cleanup is the agent's choice under the requirement to fix flaky test behavior in general: one owner for cleanup means new test files can't forget it.

Removed wherever the preload's later unmount keeps the order of the file's hooks. Kept where a later statement in the file's hooks can wake a still-mounted tree: `client.setConfig`, `queryClient.clear`, `mockRestore` or `mock.restore`, `happyDOM.setURL`, an `unblock`, or `onlineManager.setOnline`. Cleanups between renders inside a test stay.

## Not done

- Randomized test order (`bun test --randomize`): it surfaces order dependence rather than removing it.
- Resetting react-query's `onlineManager` and `focusManager` in the preload: no failure traced to them once trees unmount after every test.

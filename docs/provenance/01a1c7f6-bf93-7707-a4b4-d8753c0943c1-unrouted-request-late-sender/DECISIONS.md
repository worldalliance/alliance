## Issue chosen: ALL-1800

Agent decision, which the user deferred. Of the open flaky-test issues on 2026-11-10: ALL-1946 was already fixed on `main` by #916; ALL-1860 passed 39 loaded runs on `main` and 12 on `main` as of its filing, so no failing test could be written; ALL-1871 was in progress on the `flaky` branch; ALL-1953 is an intermittent hang inside bun. ALL-1800 reproduces every time.

## The UnroutedRequest message names an earlier test as a possible sender

Agent decision; the issue's own minimum proposal, moved from a doc comment into the error message, because the message is what a reader of a failed test sees. `serveApi` still cannot charge a late request to the test that sent it.

Not done: charging the request to its sender. `AsyncLocalStorage` set in `beforeEach` does not reach the test body, and only an `als.run` around the body carries through its timers (EVIDENCE.md). Wrapping every test body means replacing the global `it`/`test` and their variants in the preload of every package, which is more machinery than a better message is worth for this failure.

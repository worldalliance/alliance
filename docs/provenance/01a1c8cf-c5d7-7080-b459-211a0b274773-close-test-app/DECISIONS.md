# Decisions

- Fix ALL-1624. Every Linear issue titled "Flaky test" is already done or canceled. ALL-1624 is the one open AI-generated issue about a flaky test: an e2e spec's `afterAll` can hang in `app.close()` until the 50 s hook timeout. (agent decision; the user left the pick to the agent)
- Follow the fix ALL-1624 proposes: a `closeTestApp` helper beside `createTestApp` in `server/test/e2e-test-utils.ts`, holding the rationale comment once, with every e2e spec's teardown moved onto it, including the six that inlined `closeAllConnections()`. (from the ALL-1624 description)
- `closeTestApp` takes the `INestApplication`, not the `TestContext`, so `app.e2e-spec.ts`, which builds its app without `createTestApp`, uses it too. Specs that guarded teardown with `ctx?.` keep the guard at the call site, so the helper has no branch for a missing app. (agent decision)
- `server/test/close-test-app.e2e-spec.ts` pins the helper against a request still in flight when teardown runs, the case that hangs, per EVIDENCE.md. It builds a bare Nest app, so it needs no database. (agent decision)
- The spec serves its slow route as middleware that never responds, not a decorated controller, since the server's Nest lint rules require a controller to be registered in a module and to declare its API responses. (agent decision)

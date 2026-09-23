# Messaging token callback checks

The following checks ran on an earlier draft of this commit, before the refresh-loop guard and its two tests were added.

- From the repository root, `node -p 'require("socket.io-client/package.json").version'` exited 0 and printed `4.8.3`. Inspecting `node_modules/socket.io-client/build/cjs/socket.js`, method `onopen`, showed that it invokes `this.auth` when it is a function and sends the callback result in the CONNECT packet. When `this.auth` is an object, it sends that object instead.
- From `shared/`, `bun test lib/messages.test.ts` exited 0: 6 tests passed, 0 failed. The token test reads the auth callback before a socket refresh, after it, and after a later token change representing an HTTP refresh. The remaining tests cover absent sessions, rejected refresh promises, returned refresh failures, leaving non-auth errors alone without refreshing, disconnecting, or connecting, and overlapping auth errors invoking one pending refresh followed by one reconnect.
- From `shared/`, `bun test lib/messages.test.ts` with the auth-error guard temporarily removed exited 1: 5 tests passed, 1 failed because a non-auth error triggered refresh.
- From `shared/`, `bun run typecheck` exited 0, including ESLint.
- From `apps/mobile/`, `bun run typecheck` exited 0, including ESLint.
- From `shared/`, `bun test lib/messages.test.ts` with `if (refreshing) return;` temporarily removed exited 1: 5 tests passed, 1 failed because the overlapping auth errors invoked refresh twice. After restoring the guard, `bun test` exited 0: 524 tests passed, 0 failed.

## Refresh-loop guard checks

- On that draft, with the two refresh-loop regression tests added, `bun test lib/messages.test.ts` from `shared/` exited 1: 7 passed, 1 failed. After refresh succeeded, a second authentication failure invoked refresh twice instead of once.
- With the guard moved into the base commit, the same command exited 0: 8 passed, 0 failed. The tests check that another authentication failure stops refresh and that a successful connection allows a later refresh.
- With the guard and both tests, `bun run test` from the repository root exited 0: 2389 passed, 0 failed across all seven packages. `bun run typecheck` from `shared/`, `apps/mobile/`, and `apps/frontend/` each exited 0.

# Messaging refresh checks

- Source inspection at `91bd8882d`: Socket.IO client 4.8.3 calls `destroy()` before emitting `connect_error` for a middleware rejection in `node_modules/socket.io-client/build/cjs/socket.js`. `destroy()` removes the manager subscriptions used for reconnecting.
- From `shared/`, `bun test lib/messages.integration.test.ts` with the two regression tests and the implementation at `91bd8882d` exited 1. Both tests timed out waiting for a connection after the middleware rejected the expired token, including the case where refresh saved a fresh token.
- The first run after restoring explicit reconnection exited 1 because test teardown timed out after successful connections. The test server cleanup now calls `http.closeAllConnections()` after initiating `server.close()`.
- From `shared/`, `bun test lib/messages.test.ts lib/messages.integration.test.ts` with the amended implementation exited 0: 13 passed, 0 failed. The integration cases cover successful refresh, a returned refresh failure, a rejected refresh promise, rejection of the fresh token, and cleanup during the retry delay. Unit cases also cover cleanup during an in-flight refresh and the unrelated-error guard.
- From `shared/` and `apps/mobile/`, `bun run typecheck` with the amended implementation exited 0 in both packages, including their ESLint checks.
- From the repository root, `bun run test` with the amended implementation exited 0: server 531, common 823, shared 531, sharedweb 99, frontend 124, admin 190, and mobile 96 tests passed, with no failures.
- From the repository root, `bun run format:check` on the changed TypeScript, package manifests, and provenance files exited 0. `git diff --check` also exited 0.

# Launch load overtaken checks

- A login that lands while the launch `/auth/me` is still out: `session.test.ts` holds that response until `openSession` succeeds, then answers 503, 401, or a member. Before `restoreSession` compared the session it started under, all three cases failed the `SessionOvertakenError` assertion, and the 401 case called `dropSession`, which clears the new login. After, all three pass.
- A login that lands while the launch reads a stored token: `session.test.ts` starts the login once the access token read, or the refresh token read after an empty access token, is out, and holds that read until `openSession` succeeds. With the check only after `/auth/me`, `bun test lib/session.test.ts` from `apps/mobile/` failed all five cases (83 passed, 5 failed): a stored access token replaced the login's header with the old one, an empty read settled on no member, and a failed read reported a failure. Without only the check after the refresh token read, the two refresh token cases failed (86 passed, 2 failed). With a check after each read, 88 passed, 0 failed.
- A login that starts and fails while the launch `/auth/me` is still out: `session.test.ts` holds that response while `openSession`'s profile load answers 503, then answers with a member. `restoreSession` fails with `SessionOvertakenError` and neither drops nor reports the stored session, which the next launch restores. `bun test lib/session.test.ts` from `apps/mobile/` passed 88, failed 0.
- A logout that lands while the launch `/auth/me` is still out: `session.test.ts` holds that response until `closeSession` settles, then answers with a member. Without the check after `/auth/me`, the case failed; with it, `restoreSession` fails with `SessionOvertakenError`, neither drops nor reports, and the session stays closed. `bun test lib/session.test.ts` from `apps/mobile/` passed 89, failed 0.

# Launch retry screen checks

Run in mobile web with playwright, seeding a synthetic access token and answering `/auth/me` with 503 until the step under test.

- Before the fix, logging in from onboarding while the retry screen was up (the login answered with tokens minted for a local user, `/auth/me` let through) landed on the retry screen, not the app shell. After `startSession` cleared the flag, the same run landed on the app shell.
- After the fix, the retry screen showed "Log in again". Tapping it went to `/onboarding` with the stored access token removed.

# Runtime session refusal checks

- Adding the refusal subscription and regression tests without emitting notifications made `bun test lib/session.test.ts` from `apps/mobile/` fail 3 tests. HTTP refresh refusal, socket refresh refusal, and a missing refresh token each produced zero notifications where one was expected.
- After adding notifications in `refreshSession` and the signed-in provider subscription, `bun test lib/session.test.ts` from `apps/mobile/` exited 0: 100 passed, 0 failed. Tests cover HTTP refusal, socket refresh refusal and missing tokens, an old refusal after a newer login, a missing-token read after logout, server and network failures, and subscription cleanup. `dropSessionOnRefusal`, the function `AuthProvider` subscribes through, has tests for dropping once signed in, ignoring a refusal before sign-in, and cleanup. No test mounts the native `AuthProvider`.
- Removing the current-session check in `reportSessionRefusal` failed 2 tests: the old socket refusal after a newer login, and the missing-token read after logout.
- With the runtime refusal changes, `bun run typecheck` from `apps/mobile/` exited 0, including ESLint. From the repository root, `bun run test apps/mobile shared` exited 0: mobile 201 passed and shared 533 passed, including the Socket.IO integration tests.
- Removing the signed-in check in `dropSessionOnRefusal` failed 1 test: the refusal before sign-in.
- Run in mobile web with playwright against the local server, seeding an access token for a local member that expires 30 seconds in and a refresh token signed with the wrong secret. After the app shell mounted and the access token expired, tapping the Notifications tab sent `/notifs`, which answered 401. The refresh answered 401, and the app logged out and landed on `/onboarding` in the same document, with both stored tokens removed.
- The same run with `AuthContext.tsx` and `session.ts` from the parent commit stayed on `/notifications` with the shell mounted and both tokens stored, retrying `/notifs` and the refresh three times, each refresh answering 401.
- A run that remounted the app instead of tapping a tab went through the launch path: one `/auth/me` 401, one refused refresh, and one `/auth/logout`, so the provider subscription did not drop the session a second time.
- Two requests refused at once, with a `dropSession` that waits before it closes the session, called `dropSession` once. Subscribing without removing the listener when it fires made it call `dropSession` twice. `bun test lib/session.test.ts` from `apps/mobile/` then passed 101 tests. `bun run typecheck` from `apps/mobile/` exited 0, and `bun run test apps/mobile shared` passed mobile 202 and shared 533.

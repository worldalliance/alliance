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

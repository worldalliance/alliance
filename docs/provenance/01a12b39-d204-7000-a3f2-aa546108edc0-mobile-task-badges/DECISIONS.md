# Implementation decisions

Origin: agent decisions. These choices implement [the requirements](REQUIREMENTS.md) and may be reconsidered within their constraints.

## Counting

- One policy, `countsTowardTaskBadge` in `common/src/taskBadge.ts`, decides eligibility for the server's push counts, the mobile Tasks tab and app icon, and the web Tasks badge and favicon. It reads only the server-computed `ActionDto.viewer` plus `status` and `publicOnly`, so an action without `viewer` (guests) never counts. Home visibility (`showActionInSidebarList`) stays a separate rule: excluded cards can remain on Home.
- The server exposes `viewer.contractGap` (the assignment rule returned `Optional`). `viewer.optionalReason` stays `null` for admin-optional actions so optional-task copy is unchanged, which is why the policy can't read it. Onboarding actions never produce a contract gap: the assignment rule handles onboarding before contract coverage.
- Counts derive from current task state; badge pushes carry the absolute count. The in-app badge keeps its style and 99 cap; the operating system gets the full count.

## Synchronization

- The originating device patches its cached action list when the server confirms a task-form submission, a withdrawal, or a dismissal (`applyConfirmedChange` in `shared/lib/actionsListPage.ts`), then invalidates the list. The invalidation cancels any fetch already in flight, so a response that predates the change can't restore the task. Patches are idempotent, so repeated callbacks can't double-decrement.
- `useTaskBadgeCount` re-counts at the next counted deadline via `useOnNextTimestamp`, and refetches the action list every minute. Mobile also refetches when the app returns to the foreground. React Query keeps the last data on a failed refetch, and returns no count before the first load.
- `TaskBadgeService` (server) recomputes a user's count with `ActionsService.findMemberPublic`, the same payload the apps count from. It syncs immediately on the `action.activity` event (completion, withdrawal, dismissal, from any device or the website) and on the new `UserEvents.AwayRangesChanged`. A per-minute sweep under a Postgres advisory lock covers everything else: increases, deadlines, and admin edits.
- Ordering across server instances: each device row stores `badgeCount` and `badgeCountComputedAt`. A sync claims a device with one conditional `UPDATE` only when its computation started later than the stored one, and pushes only where the count changed. An older, slower computation therefore can't overwrite a newer count. A rejected push resets `badgeCount` to null, so the next sync retries it.
- Device ownership is read at claim time, after the count is computed. Re-registering a device to another account resets its badge state.
- Badge pushes follow the existing delivery gate (`notifDeliveryEnabled`: production, or `SEND_DEV_NOTIFS=1`).

## Accounts

- Logout calls the new `POST user/unregisterDevice`, which deletes the caller's own device row. The device id is held in memory (`apps/mobile/lib/registeredDevice.ts`), so the request starts before the session drops the auth header, as `closeSession` already does for its logout request. If that request fails, the next sign-in reassigns the device by push token.
- A session dropped because the server refused its refresh token can't authenticate an unregister request. The device stays linked until the next sign-in reassigns it. Every session clear zeroes the app-icon badge.

## Delivery

- A badge push sets `badge` and `data.taskBadgeCount`, with no title, body, or sound, at normal priority. iOS applies `badge` itself without showing anything. Android receives a data-only message; Expo's `badge` field is iOS-only. Badge pushes aren't stored as `Push` rows, since those model visible notifications.
- On Android, an `expo-task-manager` background task (`apps/mobile/lib/taskBadgeTask.ts`) sets the icon from the push. It is defined in a custom entry, `apps/mobile/index.ts`, so a headless launch finds it before routes load. iOS needs no task.
- The foreground notification handler shows nothing for a badge push. A running app ignores badge pushes and mirrors its own count, which already reflects every change it confirmed.
- Permission denial and unsupported launchers make `setBadgeCountAsync` fail or no-op; the in-app badge is unaffected.

## Verification

Done:

- Policy matrix: `common/src/taskBadge.test.ts`.
- `contractGap`, including admin-optional plus gap and onboarding: `server/src/actions/user-action-status.spec.ts`.
- Server sync, against a real database: `server/test/task-badge.e2e-spec.ts`. Covers the quiet payload, sending once per change, the decrease after dismissal, a newer claim winning, retry after a rejected push, account reassignment, and unregister ownership.
- Client counting, failed refetch, deadline expiry, and a stale in-flight fetch after a confirmed withdrawal: `shared/lib/useTaskBadgeCount.test.ts`.

Remaining, physical devices only:

- foreground, background, and closed-app delivery on iOS and on Android launchers that support badges
- permission denial
- unsupported launchers
- badge pushes arriving alongside normal pushes

Record any delay the operating system adds separately from server dispatch time.

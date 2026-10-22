# Implementation decisions

Origin: agent decisions. These choices implement [the requirements](REQUIREMENTS.md) and may be reconsidered within their constraints.

## Counting

- One policy, `countsTowardTaskBadge` in `common/src/taskBadge.ts`, decides eligibility for the server's push counts, the mobile Tasks tab and app icon, and the web Tasks badge and favicon. It reads only the server-computed `ActionDto.viewer` plus `status` and `publicOnly`, so an action without `viewer` (guests) never counts. Home visibility (`showActionInSidebarList`) stays a separate rule: excluded cards can remain on Home.
- The server exposes `viewer.contractGap` (the assignment rule returned `Optional`). `viewer.optionalReason` stays `null` for admin-optional actions so optional-task copy is unchanged, which is why the policy can't read it. Onboarding actions never produce a contract gap: the assignment rule handles onboarding before contract coverage.
- Counts derive from current task state; badge pushes carry the absolute count. The in-app badge keeps its style and 99 cap; the operating system gets the full count.

## Synchronization

- The originating device patches its cached action list when the server confirms a task-form submission, a withdrawal, or a dismissal (`applyConfirmedChange` in `shared/lib/actionsListPage.ts`), then invalidates the list. The invalidation cancels any fetch already in flight, so a response that predates the change can't restore the task. Patches are idempotent, so repeated callbacks can't double-decrement.
- `useTaskBadgeCount` re-counts at the next counted deadline via `useOnNextTimestamp`, and refetches the action list every minute. Mobile also refetches when the app returns to the foreground. React Query keeps the last data on a failed refetch, and returns no count before the first load.
- `TaskBadgeService` (server) recomputes a user's count with `ActionsService.findMemberOpen`: the payload the apps count from, built only for actions in their member-action phase, since no other action counts. The sweep finds those actions once and loads only them for each user. It skips users with no badge-capable device before computing anything. It syncs immediately on the `action.activity` event (completion, withdrawal, dismissal, from any device or the website) and on the new `UserEvents.AwayRangesChanged`. A per-minute sweep under a Postgres advisory lock covers everything else: increases, deadlines, and admin edits. A sweep that outlasts its minute logs a warning.
- Ordering across server instances: each device row stores `badgeCount` and `badgeCountComputedAt`. A sync locks the user's device rows, then claims each with one conditional `UPDATE` only when its computation started later than the stored one, and pushes only where the count changed. Locking first makes the comparison read the latest committed count, not the one from before a concurrent sync's write. An older, slower computation therefore can't overwrite a newer count; a sweep's computations date from when it found the open actions. A push that fails when it's sent resets `badgeCount` to null, so the next sync retries it. So does an accepted one whose count a newer sync replaced with a different count while it was in flight, since either push may arrive last. A device Expo reports unregistered is removed instead, and one whose token isn't an Expo push token is never sent and keeps its count, since resending can't fix it. Delivery failures Expo reports later, in push receipts, aren't checked; the app corrects the icon from its own count in the foreground.
- Device ownership is read at claim time, after the count is computed. Re-registering a device to another account resets its badge state.
- Badge pushes follow the existing delivery gate (`notifDeliveryEnabled`: production, or `SEND_DEV_NOTIFS=1`).
- Badge pushes go only to devices whose build registered with `taskBadgePushes: true`. Builds from before this feature show any push in the foreground, including a badge-only one, and don't unlink on logout.

## Accounts

- Every session clear, a logout or a session the server refused, calls the new public `POST user/unregisterDevice` with the device id and push token stored at registration (`apps/mobile/lib/deviceLink.ts`). The server deletes the row only when both match, so an expired access token doesn't block the unlink; the endpoint is rate-limited per IP, loosely enough for a shared network and a phone's retries. Registrations and unlinks run one at a time in order, each reading the device id and token the last one stored, so an unlink can't miss a registration in flight and a late unlink can't delete the row a new session linked. The unlink is recorded as pending the moment the session clears. Each request has a 30-second deadline so a stalled one can't hold back the queue; a registration that lands past it is stored as the link while its session is open and it awaits a retry; after its session closed, it is unlinked and the session open since relinked. A failed unlink stays pending and is reported unless the phone is offline or the request timed out: the app retries it on launch and on returning to the foreground until the server confirms it or a new sign-in registers the device. A failed registration is retried the same way, ahead of a pending unlink, and dropped once its session closes. A registration whose response never arrives leaves a row the unlink can't name (ALL-1579).
- Every session clear zeroes the app-icon badge.

## Delivery

- A badge push sets `badge` and `data.taskBadgeCount`, with no title, body, or sound, at normal priority. iOS applies `badge` itself without showing anything. Android receives a data-only message; Expo's `badge` field is iOS-only. Badge pushes aren't stored as `Push` rows, since those model visible notifications.
- On Android, an `expo-task-manager` background task (`apps/mobile/lib/taskBadgeTask.ts`) sets the icon from the push. It is defined in a custom entry, `apps/mobile/index.ts`, so a headless launch finds it when the bundle loads. iOS needs no task. `expo-task-manager` changes the native fingerprint, so this part reaches users only with a new store build. expo-notifications never passes a data-only push to the foreground notification handler on Android, so while the app is in the foreground the task refetches the action list instead.
- The foreground notification handler shows nothing for a badge push and refetches the action list instead of applying the pushed number, which may predate the app's own latest count. The app then mirrors its own count, and reapplies it on returning to the foreground, since a badge push applied in the background may have moved the icon off a count the refetch leaves unchanged.
- The app registers with `taskBadgePushes: true` from the build that has this handler, so earlier builds get no badge pushes. This part is JavaScript only and reaches installed builds over the air.
- Permission denial and unsupported launchers make `setBadgeCountAsync` fail or no-op; the in-app badge is unaffected.
- On Android, `setBadgeCountAsync(0)` also dismisses every notification the app is showing, so a zero goes through a local module, `apps/mobile/modules/app-icon-badge`, that clears only the launcher badge (`apps/mobile/lib/appIconBadge.ts`). Builds without that module never get an Android icon count, since they couldn't clear it; the module is native, so Android's icon count reaches users only with a new store build.

## Verification

Done:

- Policy matrix: `common/src/taskBadge.test.ts`.
- `contractGap`, including admin-optional plus gap and onboarding: `server/src/actions/user-action-status.spec.ts`.
- Server sync, against a real database: `server/test/task-badge.e2e-spec.ts`. Covers the quiet payload, sending once per change, the decrease after dismissal, a newer claim winning, retry after a push that threw or was rejected, removal of a device Expo reports unregistered, no retry for an invalid token, account reassignment, and unregistering only with the device's push token.
- Client counting, failed refetch, deadline expiry, and a stale in-flight fetch after a confirmed withdrawal: `shared/lib/useTaskBadgeCount.test.ts`.

Remaining, physical devices only:

- foreground, background, and closed-app delivery on iOS and on Android launchers that support badges
- permission denial
- unsupported launchers
- badge pushes arriving alongside normal pushes

Record any delay the operating system adds separately from server dispatch time.

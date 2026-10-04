## Cause

Suspension accounting (`ActionsService.buildSuspendPlanContext`) and every other assignment reader derive away exemptions from the member's current `UserAwayRange` rows on each run. Since the stricter missed-suite rule (#392), any exempted suite that loses its exemption can complete a three-suite run. Members could delete or edit any range, including ones already elapsed, so deleting a past range brought back the suites it had excused and suspended them. The stable-action-assignments decision to keep deriving away overlap from live ranges, including retrospective edits and deletions, is superseded by the requirement that only admins or direct DB edits may change past assignments.

## Rule

Member routes may not change the part of a range before now. Admin routes (`/user/admin/:userId/awayranges...`) keep their existing behavior. `applyMemberAwayRangeEdit` in `server/src/user/away-range-history.ts` holds the rule; `AwayRangeEditor` selects it in `UserService`.

- A range's start locks once it has begun and an hour has passed since its creation (`isAwayRangeStartLocked` in `common/src/awayRange.ts`, shared with the clients). Until then a member may delete it or move its start as if it had not begun. Review found that a range created for today begins at once, so without this a mistaken one could never be removed, only cut down to a stub. The user chose a 60-minute grace period over the alternatives (keeping the stub, hiding stubs in the UI, or allowing deletion when no deadline fell inside the elapsed part), on the condition that it stay small; it fits in the one predicate. Removing a range within the hour un-excuses any window open during those minutes, including one whose deadline passed in that hour, which the user accepted with that choice. A range that starts before it was created gets no undo hour: only staff can backdate one, and the hour would otherwise let the member remove the history staff just set. A member's create stamps `createdAt` with the same instant its start is clamped to, so that start never reads as earlier than the creation, whatever the database clock says.
- Delete of a range whose start has not locked removes it. Delete of a range in progress ends it now, which is what a member returning early wants and keeps the elapsed part. Delete of an ended range is rejected with 400 and its own message.
- Update of a range whose start has locked cannot move its start; an ongoing range's end may move to any time from now on; an ended range's dates cannot change. Reason and note stay editable on any range because they do not affect assignment.
- Create, and moving the start of an unstarted range, clamp a start earlier than now to now. The existing 36-hour tolerance for picking "today" still decides which start days are accepted, but no longer lets a member backdate an exemption over a deadline that already passed earlier that day. A start beyond the tolerance is rejected, including on update, where it was previously unvalidated.
- For a member, update treats a submitted day equal to the stored day (in the user's time zone) as unchanged and keeps the stored instant: clamped starts and early ends are mid-day instants a day-to-instant round trip would otherwise move. An admin's submitted day always means the whole day, so staff can widen a mid-day start back to midnight; the admin form sends only the days the admin changed, so a note-only edit leaves the instants alone.

Ending a range by a direct DB edit or admin route is unchanged, so staff corrections still flow through the live derivation.

## Clients

The client changes land before the server rule so each commit deploys alone. The web edit form sends only the days a member changed: it formats days in the browser's time zone while the server reads them in the account's, so a resent untouched day could name a different day and read as moving a started range's start. The web form locks the dates the server would reject, keeping reason and note editable on ended ranges. Hiding delete on ended ranges, and the labels and confirmations that describe deleting a range in progress as ending it now, follow the server rule: before it, an ended range a member created within the 36-hour start tolerance would have no way to be removed, and the wording would be false.

## Not changed

- Withdrawal ("won't complete") after a deadline is still allowed for members and still satisfies a missed suite. It changes the outcome of an assignment, not the assignment, and its handling was preserved by the missed-suite requirements.
- Existing rows are not migrated; ranges members already deleted are gone.

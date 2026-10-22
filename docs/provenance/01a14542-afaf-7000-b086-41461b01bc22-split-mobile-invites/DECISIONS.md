# Split the mobile invites screen under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The fix is splitting the 1014-line screen along its feature boundaries, with no change to what the user sees. Layout, from the options `codex exec` proposed per the repo's file-size rule:
  - `apps/mobile/components/forms/DatePickerField.tsx`: the calendar date picker, moved unchanged.
  - `formatMediumDate` in `shared/lib/dateFormatters.ts`: the "Jan 1, 2025" device-locale format the picker and the goal card both display, beside the repo's other named formats, replacing the screen's local `formatDate`.
  - `apps/mobile/components/AmbassadorInviteGoalCard.tsx`: the ambassador goal card, mirroring the web `apps/frontend/src/components/AmbassadorInviteGoalCard.tsx` boundary. Like the web card it calls `useAmbassadorInviteDashboard` and `useAllianceMemberCount` itself, and the screen keeps its own `useAmbassadorInviteDashboard` call only for refetching on pull-to-refresh and after an invite is created, as the web `InvitesPage` does. Both calls share one query key, so they share one query.
  - `apps/mobile/components/CurrentInviteGoal.tsx`: the current goal's summary, actions, edit form, and progress. Without it the card alone would be past 500 lines.
  - `apps/mobile/app/(app)/invites.tsx` keeps invite loading, bucketing, actions, tabs, and the settings modal.
- The edit-form open state stays in the card, not `CurrentInviteGoal`, so collapsing the card keeps it, as before.
- `useAllianceMemberCount` now runs only for ambassadors, the only users who see the count; it used to run for every signed-in user.
- The goal card's dashboard destructuring and `selectInviteGoals` memo match the web card's verbatim. That duplication predates the split (the mobile screen held the same lines) and is left as is.
- No new unit tests: the moved code is rendering and React state with no unit tests before, and mobile has no component-test harness. Typecheck and lint verify the wiring.
- Two commits: the date picker extraction stands alone; the goal card extraction is what brings the screen under the limit and drops the waiver.

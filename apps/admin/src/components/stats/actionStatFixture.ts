import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";

export const actionStat = (
  overrides: Partial<ActionStatsWithOnboardingDto>,
): ActionStatsWithOnboardingDto => ({
  id: 1,
  actionId: 1,
  actionName: "Call a rep",
  usersCompleted: 0,
  usersJoined: 0,
  usersWithdrawn: 0,
  usersDismissed: 0,
  completionRate: 0,
  lastCalculatedAt: "2026-02-01T00:00:00Z",
  actionCompletedAt: null,
  showInChart: true,
  memberActionStartDate: null,
  memberActionEndDate: null,
  onboarding: false,
  optional: false,
  ...overrides,
});

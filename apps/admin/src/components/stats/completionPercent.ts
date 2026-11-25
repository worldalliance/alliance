import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";

export const completionPercent = (action: ActionStatsWithOnboardingDto) =>
  action.usersJoined > 0 ? Math.round(action.completionRate * 100) : null;

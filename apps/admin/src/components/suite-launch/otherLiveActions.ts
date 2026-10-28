import type { AdminActionListItemDto } from "@alliance/shared/client";
import type { LaunchSchedule } from "./launchSchedule";

/** Actions outside the suite whose member action window overlaps the launch's. */
export function otherLiveActions<
  A extends Pick<
    AdminActionListItemDto,
    | "id"
    | "archived"
    | "onboarding"
    | "memberActionStart"
    | "memberActionDeadline"
  > & { suite?: { id: number } },
>(params: { actions: A[]; suiteId: number; schedule: LaunchSchedule }): A[] {
  const { actions, suiteId, schedule } = params;
  return actions.filter(
    (action) =>
      !action.archived &&
      !action.onboarding &&
      action.suite?.id !== suiteId &&
      action.memberActionStart !== null &&
      new Date(action.memberActionStart) < schedule.officeActionAt &&
      (action.memberActionDeadline === null ||
        new Date(action.memberActionDeadline) > schedule.memberActionAt),
  );
}

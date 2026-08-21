import { UserActionRelationPillStatus } from "../user/dto/user-action-relations.dto";

export type UserActionPillStatusInput = {
  isJoined: boolean;
  /**
   * Whether the user is away during the action's member-action phase *and* in
   * the action's cohort. Both conditions are required and are checked upstream.
   */
  isAway: boolean;
  optional: boolean;
  deadlinePassed: boolean;
  /**
   * Status from the user's most recent status-bearing activity, or `null` when
   * no activity determines a status.
   */
  activityStatus: UserActionRelationPillStatus | null;
};

/**
 * Resolves a single user's pill status for a single action. Precedence: a
 * terminal activity wins, then away, then a joined participant's task status,
 * else not_required.
 */
export function resolveUserActionPillStatus(
  input: UserActionPillStatusInput,
): UserActionRelationPillStatus {
  if (input.activityStatus) {
    return input.activityStatus;
  }

  if (input.isAway) {
    return UserActionRelationPillStatus.Away;
  }

  if (input.isJoined) {
    if (input.optional) {
      return UserActionRelationPillStatus.OptionalTask;
    }
    if (input.deadlinePassed) {
      return UserActionRelationPillStatus.MissedDeadline;
    }
    return UserActionRelationPillStatus.Todo;
  }

  return UserActionRelationPillStatus.NotRequired;
}

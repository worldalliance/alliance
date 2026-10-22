import type { MemberActionPhase } from "@alliance/common/actionEvent";
import { ActionEvent } from "../entities/action-event.entity";

/**
 * Whether a schedule change brings the member-action deadline earlier,
 * including giving a deadline to a phase that had none.
 */
export function shortensMemberActionDeadline(
  before: MemberActionPhase<ActionEvent>,
  after: MemberActionPhase<ActionEvent>,
): boolean {
  if (!after.deadlineEvent) return false;
  return (
    !before.deadlineEvent ||
    after.deadlineEvent.date < before.deadlineEvent.date
  );
}

import {
  actionFormIds,
  type ReferencedAction,
} from "@alliance/common/cohort-expression";
import type { AdminActionListItemDto } from "@alliance/shared/client";

export const referencedActionFromListItem = (
  item: Pick<
    AdminActionListItemDto,
    | "id"
    | "taskFormId"
    | "variantFormIds"
    | "onboarding"
    | "memberActionDeadline"
  >,
): ReferencedAction => ({
  id: item.id,
  formIds: actionFormIds(item),
  onboarding: item.onboarding,
  deadline: item.memberActionDeadline
    ? new Date(item.memberActionDeadline)
    : null,
});

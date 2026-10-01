import type {
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { calculateCompletionData } from "@alliance/shared/lib/actionUtils";
import { useMemo } from "react";

export function useCompletedAllActiveActions(params: {
  actionSummaries: UserActionSummaryDto[];
  userActionRelations: Record<number, UserActionRelationDetailDto[]> | null;
}): Record<number, boolean> {
  const { actionSummaries, userActionRelations } = params;

  return useMemo(() => {
    if (!userActionRelations) {
      return {};
    }
    return calculateCompletionData({
      filteredActionIds: actionSummaries
        .filter((action) => action.status === "member_action")
        .map((action) => action.id),
      userActionRelations,
    }).completedAllCurrentActions;
  }, [actionSummaries, userActionRelations]);
}

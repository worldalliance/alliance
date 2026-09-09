import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { ActionDto, actionsFindAllLoggedIn } from "../client";
import { FilterMode, isStaffPreview } from "./actionUtils";

export const useActionsQuery = (options?: {
  refetchInterval?: number | false;
}): UseQueryResult<ActionDto[], Error> =>
  useQuery({
    queryKey: ["actions"],
    queryFn: () =>
      actionsFindAllLoggedIn({ query: { sorted: true } }).then(
        (response) =>
          response.data?.filter(
            // The one draft its viewer is meant to see.
            (action) => action.status !== "draft" || isStaffPreview(action),
          ) ?? [],
      ),
    refetchInterval: options?.refetchInterval,
  });

export const filterActions = (
  actions: ActionDto[],
  mode: FilterMode,
): ActionDto[] => {
  switch (mode) {
    case FilterMode.All:
      return actions.filter((action) => action.status !== "planned");
    case FilterMode.CompletedByMe:
      return actions.filter((action) => action.userRelation === "completed");
    case FilterMode.PendingOfficeResolution:
      return actions.filter((action) => action.status === "office_action");
    case FilterMode.MemberAction:
      return actions.filter(
        (action) => action.status === "member_action" && !action.onboarding,
      );
    case FilterMode.Past:
      return actions.filter(
        (action) => action.status === "completed" || action.status === "failed",
      );
    default:
      const x: never = mode;
      throw new Error(`Invalid filter mode: ${x}`);
  }
};

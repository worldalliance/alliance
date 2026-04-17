import { ActionDto, actionsFindAllLoggedIn } from "../client";
import { FilterMode } from "./actionUtils";
import { UseQueryResult, useQuery } from "@tanstack/react-query";

export const useActionsQuery = (options?: {
  refetchInterval?: number | false;
}): UseQueryResult<ActionDto[], Error> =>
  useQuery({
    queryKey: ["actions"],
    queryFn: () =>
      actionsFindAllLoggedIn({ query: { sorted: true } }).then(
        (response) =>
          response.data?.filter((action) => action.status !== "draft") ?? [],
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
        (action) =>
          action.status === "member_action" && !action.everyoneShouldComplete,
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

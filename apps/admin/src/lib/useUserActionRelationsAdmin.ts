import {
  type ActionActivityType,
  actionsActionRelationsForUserAdmin,
  actionsCreateActivityAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { loaderPrefetchStaleTime } from "./queryClient";

/** The member's action relations, for a route loader to start before the
 * page mounts. */
export const userActionRelationsQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.userActionRelationsAdmin(userId),
    queryFn: () =>
      actionsActionRelationsForUserAdmin({
        path: { userId },
        throwOnError: true,
      }).then((r) => r.data),
    staleTime: loaderPrefetchStaleTime,
  });

/** One member's status on each action, and the admin override that records
 * an activity for them. */
export function useUserActionRelationsAdmin(userId: number) {
  const queryClient = useQueryClient();
  const options = userActionRelationsQuery(userId);
  const { queryKey } = options;
  const query = useQuery({
    ...options,
    select: (data) => ({
      actionSummaries: data.actions,
      actionRelations:
        data.users.find((entry) => entry.userId === userId)?.relations ?? [],
    }),
  });

  const createActivity = useMutation({
    mutationFn: ({
      actionId,
      type,
    }: {
      actionId: number;
      type: ActionActivityType;
    }) =>
      actionsCreateActivityAdmin({
        body: { actionId, userId, type },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { query, createActivity };
}

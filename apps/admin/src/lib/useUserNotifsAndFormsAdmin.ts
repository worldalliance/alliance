import {
  notifsNotifsForUserAdmin,
  tasksGetFormsForUserSidAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { loaderPrefetchStaleTime } from "./queryClient";

/** The member's notifications, for a route loader to start before the page
 * mounts. */
export const userNotifsQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.userNotifsAdmin(userId),
    queryFn: () =>
      notifsNotifsForUserAdmin({
        path: { id: userId },
        throwOnError: true,
      }).then((r) => r.data),
    staleTime: loaderPrefetchStaleTime,
  });

/** The member's form submissions, for a route loader to start before the
 * page mounts. */
export const userFormResponsesQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.userFormResponsesAdmin(userId),
    queryFn: () =>
      tasksGetFormsForUserSidAdmin({
        path: { userId },
        throwOnError: true,
      }).then((r) => r.data),
    staleTime: loaderPrefetchStaleTime,
  });

export function useUserNotifsAndFormsAdmin(userId: number) {
  const notifs = useQuery(userNotifsQuery(userId));
  const formResponses = useQuery(userFormResponsesQuery(userId));
  return { notifs, formResponses };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  actionsAllGeneralUpdates,
  actionsDismissGeneralUpdate,
  actionsUnreadGeneralUpdates,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { parseGeneralUpdate, type ParsedGeneralUpdate } from "./generalUpdates";
import { queryKeys } from "./queryKeys";

const UNREAD_QUERY_KEY = queryKeys.generalUpdatesUnread();
const ALL_QUERY_KEY = queryKeys.generalUpdatesAll();

/**
 * Use instead of the generated client so web and mobile share parsing, cache
 * keys, and dismissal updates.
 */
export function useUnreadGeneralUpdates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: UNREAD_QUERY_KEY,
    queryFn: () =>
      actionsUnreadGeneralUpdates({ throwOnError: true }).then((response) =>
        response.data.map(parseGeneralUpdate),
      ),
    // Both home screens hold their main content until this settles.
    retry: false,
  });
  const {
    data: generalUpdates = [],
    isLoading,
    isPending,
    isError,
    isFetching,
    refetch,
  } = query;

  const dismissGeneralUpdate = useCallback(
    async (generalUpdateId: number) => {
      await actionsDismissGeneralUpdate({ path: { generalUpdateId } });
      queryClient.setQueryData<ParsedGeneralUpdate[]>(
        UNREAD_QUERY_KEY,
        (prev) => prev?.filter((update) => update.id !== generalUpdateId) ?? [],
      );
    },
    [queryClient],
  );

  return {
    generalUpdates,
    isLoading,
    isPending,
    isError,
    isFetching,
    didFail: failedToLoad(query),
    refetch,
    dismissGeneralUpdate,
  };
}

export function useAllGeneralUpdates() {
  const query = useQuery({
    queryKey: ALL_QUERY_KEY,
    queryFn: () =>
      actionsAllGeneralUpdates({ throwOnError: true }).then((response) =>
        response.data.map(parseGeneralUpdate),
      ),
  });
  const {
    data: generalUpdates = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = query;

  return {
    generalUpdates,
    isLoading,
    isError,
    isFetching,
    didFail: failedToLoad(query),
    refetch,
  };
}

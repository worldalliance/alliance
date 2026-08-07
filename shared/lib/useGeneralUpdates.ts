import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  actionsAllGeneralUpdates,
  actionsDismissGeneralUpdate,
  actionsUnreadGeneralUpdates,
} from "../client";
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

  const {
    data: generalUpdates = [],
    isLoading,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: UNREAD_QUERY_KEY,
    queryFn: () =>
      actionsUnreadGeneralUpdates().then((response) =>
        (response.data ?? []).map(parseGeneralUpdate),
      ),
  });

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
    refetch,
    dismissGeneralUpdate,
  };
}

export function useAllGeneralUpdates() {
  const {
    data: generalUpdates = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ALL_QUERY_KEY,
    queryFn: () =>
      actionsAllGeneralUpdates().then((response) =>
        (response.data ?? []).map(parseGeneralUpdate),
      ),
  });

  return { generalUpdates, isLoading, isError, refetch };
}

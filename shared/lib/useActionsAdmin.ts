import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { actionsFindAllWithDraftsAdmin } from "../client";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.actionsAllAdmin();

/** Every action, drafts and archived included. */
export function useActionsAdmin() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      actionsFindAllWithDraftsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

/** For writes that change fields the all-actions list shows. */
export function useInvalidateActionsAdmin(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient],
  );
}

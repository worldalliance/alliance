import { skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { actionsFindOne } from "../client";
import { queryKeys } from "./queryKeys";

export function useAction(
  actionId: number | null,
  params?: { enabled?: boolean },
) {
  const { enabled = true } = params ?? {};
  return useQuery({
    queryKey: queryKeys.action(actionId),
    queryFn:
      actionId === null
        ? skipToken
        : () =>
            actionsFindOne({ path: { id: actionId }, throwOnError: true }).then(
              (res) => res.data,
            ),
    enabled,
    // Long enough that re-hovering an action link reuses its preview.
    staleTime: milliseconds({ minutes: 5 }),
  });
}

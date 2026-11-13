import { mmsThreadGetThreadAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

const threadQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.memberTextThreadAdmin(userId),
    queryFn: () =>
      mmsThreadGetThreadAdmin({ path: { userId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchInterval: milliseconds({ seconds: 10 }),
  });

export function useMemberTextsAdmin(userId: number) {
  return { thread: useQuery(threadQuery(userId)) };
}

import {
  mmsThreadGetThreadAdmin,
  mmsThreadMarkHandledAdmin,
  mmsThreadMarkNeedsReplyAdmin,
  mmsThreadMarkOptedOutAdmin,
  mmsThreadNeedsReplyAdmin,
  mmsThreadSendTextAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useThreadActions } from "./useTextThreadsAdmin";

const needsReplyQuery = queryOptions({
  queryKey: queryKeys.needsReplyAdmin(),
  queryFn: () =>
    mmsThreadNeedsReplyAdmin({ throwOnError: true }).then((r) => r.data),
  refetchInterval: milliseconds({ seconds: 30 }),
});

export function useNeedsReplyAdmin() {
  return useQuery(needsReplyQuery);
}

/** The Needs reply badge's count: null until the list first loads if that
 * load fails, so a failure doesn't read as nobody waiting; a later failed
 * poll keeps the last count. */
export function useNeedsReplyCount(): number | null {
  const { data, isError } = useNeedsReplyAdmin();
  return data?.length ?? (isError ? null : 0);
}

export const fetchMemberThread = (params: {
  userId: number;
  before?: number;
}) =>
  mmsThreadGetThreadAdmin({
    path: { userId: params.userId },
    query: { before: params.before },
    throwOnError: true,
  }).then((r) => r.data);

const threadQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.memberTextThreadAdmin(userId),
    queryFn: () => fetchMemberThread({ userId }),
    refetchInterval: milliseconds({ seconds: 10 }),
  });

export function useMemberTextsAdmin(userId: number) {
  const thread = useQuery(threadQuery(userId));
  const actions = useThreadActions({
    id: userId,
    queryKey: (id: number) => threadQuery(id).queryKey,
    sendText: (input) =>
      mmsThreadSendTextAdmin({
        path: { userId: input.id },
        body: { body: input.body },
        throwOnError: true,
      }).then((r) => r.data),
    markOptedOut: (id) =>
      mmsThreadMarkOptedOutAdmin({ path: { userId: id }, throwOnError: true }),
    optOutKey: ["markOptedOutAdmin"],
    markHandled: (input) =>
      mmsThreadMarkHandledAdmin({
        path: { userId: input.id },
        body: { throughId: input.throughId },
        throwOnError: true,
      }),
    markNeedsReply: (input) =>
      mmsThreadMarkNeedsReplyAdmin({
        path: { userId: input.id },
        body: { throughId: input.throughId },
        throwOnError: true,
      }),
  });
  return { thread, ...actions };
}

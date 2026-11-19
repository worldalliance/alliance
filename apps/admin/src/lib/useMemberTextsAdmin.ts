import {
  mmsThreadGetThreadAdmin,
  mmsThreadMarkHandledAdmin,
  mmsThreadMarkNeedsReplyAdmin,
  mmsThreadMarkOptedOutAdmin,
  mmsThreadSendTextAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useThreadActions } from "./useTextThreadsAdmin";

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

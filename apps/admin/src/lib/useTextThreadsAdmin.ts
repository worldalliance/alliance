import {
  mmsThreadGetNumberThreadAdmin,
  mmsThreadMarkThreadHandledAdmin,
  mmsThreadMarkThreadNeedsReplyAdmin,
  mmsThreadMarkThreadOptedOutAdmin,
  mmsThreadNeedsReplyThreadsAdmin,
  mmsThreadSendInThreadAdmin,
} from "@alliance/shared/client";
import type { MmsMessageDto } from "@alliance/shared/client/types.gen";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  type DataTag,
  type QueryKey,
  partialMatchKey,
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { usePatchAnyQueryData } from "./usePatchQueryData";

const needsReplyQuery = queryOptions({
  queryKey: queryKeys.needsReplyAdmin(),
  queryFn: () =>
    mmsThreadNeedsReplyThreadsAdmin({ throwOnError: true }).then((r) => r.data),
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

type ThreadMark<Id> = { id: Id; throughId: number };

/** Mutations take the thread's id, so one that settles after the page moves
 * to another thread still acts on, and updates the cache of, the thread it
 * was made for. */
export function useThreadActions<
  Id,
  T extends { messages: MmsMessageDto[]; optedOut: boolean },
>(params: {
  id: Id;
  queryKey: (id: Id) => DataTag<QueryKey, T, Error>;
  sendText: (input: { id: Id; body: string }) => Promise<MmsMessageDto>;
  /** Must answer 409 only for a number that has already opted out, which
   * the hook treats as success. */
  markOptedOut: (id: Id) => Promise<unknown>;
  optOutKey: QueryKey;
  markHandled: (input: ThreadMark<Id>) => Promise<unknown>;
  markNeedsReply: (input: ThreadMark<Id>) => Promise<unknown>;
}) {
  const { id, queryKey, optOutKey } = params;
  const queryClient = useQueryClient();
  const patch = usePatchAnyQueryData();
  const refreshViews = (target: Id) => {
    const keys = [
      queryKey(target),
      needsReplyQuery.queryKey,
      queryKeys.memberTextThreadsAdminAll(),
      queryKeys.numberTextThreadsAdminAll(),
    ];
    // One call, so a query under several keys refetches once, and a poll
    // already in flight restarts rather than landing the state before the
    // change.
    return queryClient.invalidateQueries({
      predicate: (query) =>
        keys.some((key) => partialMatchKey(query.queryKey, key)),
    });
  };

  const send = useMutation({
    mutationFn: params.sendText,
    onSuccess: async (message, input) => {
      await patch(queryKey(input.id), (prev) =>
        prev.messages.some((m) => m.id === message.id)
          ? prev
          : { ...prev, messages: [...prev.messages, message] },
      );
      // An undelivered text doesn't answer the contact, so only the server
      // knows the reply state now.
      void refreshViews(input.id);
    },
  });

  const markOptedOut = useMutation({
    mutationKey: optOutKey,
    mutationFn: (target: Id) =>
      params.markOptedOut(target).catch((thrown: unknown) => {
        if (thrownStatus(thrown) !== 409) throw thrown;
      }),
    onSuccess: async (_, target) => {
      await patch(queryKey(target), (prev) => ({ ...prev, optedOut: true }));
      void refreshViews(target);
    },
    onError: (_, target) =>
      queryClient.invalidateQueries({ queryKey: queryKey(target) }),
  });

  // Read from the mutation cache, which outlives this page's observer, so a
  // return visit mid-request still shows the opt-out pending.
  const pendingOptOuts = useMutationState({
    filters: { mutationKey: optOutKey, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  const markHandled = useMutation({
    mutationFn: params.markHandled,
    onSettled: (_data, _error, input) => refreshViews(input.id),
  });

  const markNeedsReply = useMutation({
    mutationFn: params.markNeedsReply,
    onSettled: (_data, _error, input) => refreshViews(input.id),
  });

  return {
    send: (body: string) => send.mutateAsync({ id, body }),
    sentId: send.data?.id,
    markOptedOut: () => markOptedOut.mutateAsync(id),
    markingOptedOut: pendingOptOuts.includes(id),
    markHandled: (throughId: number) =>
      markHandled.mutateAsync({ id, throughId }),
    markNeedsReply: (throughId: number) =>
      markNeedsReply.mutateAsync({ id, throughId }),
    markingHandled: markHandled.isPending && markHandled.variables.id === id,
    markingNeedsReply:
      markNeedsReply.isPending && markNeedsReply.variables.id === id,
  };
}

const numberThreadQuery = (threadId: string) =>
  queryOptions({
    queryKey: queryKeys.numberTextThreadAdmin(threadId),
    queryFn: () => fetchNumberThread({ threadId }),
    refetchInterval: milliseconds({ seconds: 10 }),
  });

export const fetchNumberThread = (params: {
  threadId: string;
  before?: number;
}) =>
  mmsThreadGetNumberThreadAdmin({
    path: { threadId: params.threadId },
    query: { before: params.before },
    throwOnError: true,
  }).then((r) => r.data);

export function useNumberThreadAdmin(threadId: string) {
  const thread = useQuery(numberThreadQuery(threadId));
  const actions = useThreadActions({
    id: threadId,
    queryKey: (id: string) => numberThreadQuery(id).queryKey,
    sendText: (input) =>
      mmsThreadSendInThreadAdmin({
        path: { threadId: input.id },
        body: { body: input.body },
        throwOnError: true,
      }).then((r) => r.data),
    markOptedOut: (id) =>
      mmsThreadMarkThreadOptedOutAdmin({
        path: { threadId: id },
        throwOnError: true,
      }),
    optOutKey: ["markThreadOptedOutAdmin"],
    markHandled: (input) =>
      mmsThreadMarkThreadHandledAdmin({
        path: { threadId: input.id },
        body: { throughId: input.throughId },
        throwOnError: true,
      }),
    markNeedsReply: (input) =>
      mmsThreadMarkThreadNeedsReplyAdmin({
        path: { threadId: input.id },
        body: { throughId: input.throughId },
        throwOnError: true,
      }),
  });

  return { thread, ...actions };
}

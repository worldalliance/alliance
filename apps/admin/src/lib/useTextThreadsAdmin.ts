import {
  mmsThreadGetNumberThreadAdmin,
  mmsThreadListThreadsAdmin,
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
  type QueryFunction,
  type QueryKey,
  partialMatchKey,
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { maxBy } from "es-toolkit";
import { staffTextConflict } from "./memberTexts";
import { useMmsThreadsLive } from "./mmsThreadsLive";
import { usePatchAnyQueryData } from "./usePatchQueryData";

// Pushes refetch thread queries while the socket is connected, so polling then
// only backs them up.
const LIVE_POLL_MS = milliseconds({ seconds: 60 });

export function usePollInterval(offlineMs: number): number {
  return useMmsThreadsLive().connected ? LIVE_POLL_MS : offlineMs;
}

const needsReplyQuery = queryOptions({
  queryKey: queryKeys.needsReplyAdmin(),
  queryFn: () =>
    mmsThreadNeedsReplyThreadsAdmin({ throwOnError: true }).then((r) => r.data),
});

export function useNeedsReplyAdmin() {
  return useQuery({
    ...needsReplyQuery,
    refetchInterval: usePollInterval(milliseconds({ seconds: 30 })),
  });
}

/** The Needs reply badge's count: null until the list first loads if that
 * load fails, so a failure doesn't read as nobody waiting; a later failed
 * poll keeps the last count. */
export function useNeedsReplyCount(): number | null {
  const { data, isError } = useNeedsReplyAdmin();
  return data?.length ?? (isError ? null : 0);
}

export function useTextThreadListAdmin(
  query: { page: number; search: string },
  { enabled }: { enabled: boolean },
) {
  return useQuery({
    queryKey: queryKeys.textThreadsAdmin(query),
    enabled,
    // Paging keeps the current page up until the next arrives; a new search
    // doesn't, so its results are never mistaken for the previous search's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1].search === query.search ? previous : undefined,
    queryFn: () =>
      mmsThreadListThreadsAdmin({
        query: { page: query.page, search: query.search || undefined },
        throwOnError: true,
      }).then((r) => r.data),
  });
}

type ThreadMark<Id> = { id: Id; throughId: number };

/** Mutations take the thread's id, so one that settles after the page moves
 * to another thread still acts on, and updates the cache of, the thread it
 * was made for. */
export function useThreadActions<
  Id,
  T extends { messages: MmsMessageDto[]; optedOut: boolean },
  Key extends QueryKey,
>(params: {
  id: Id;
  query: (id: Id) => {
    queryKey: DataTag<Key, T, Error>;
    queryFn?: QueryFunction<T, Key>;
  };
  sendText: (input: {
    id: Id;
    body: string;
    afterId: number | null;
  }) => Promise<MmsMessageDto>;
  /** Must answer 409 only for a number that has already opted out, which
   * the hook treats as success. */
  markOptedOut: (id: Id) => Promise<unknown>;
  optOutKey: QueryKey;
  markHandled: (input: ThreadMark<Id>) => Promise<unknown>;
  markNeedsReply: (input: ThreadMark<Id>) => Promise<unknown>;
}) {
  const { id, optOutKey } = params;
  const queryKey = (target: Id) => params.query(target).queryKey;
  const queryClient = useQueryClient();
  const patch = usePatchAnyQueryData();
  const refreshViews = (target: Id) => {
    const keys = [
      queryKey(target),
      needsReplyQuery.queryKey,
      queryKeys.textThreadsAdminAll(),
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
    // Awaited so the refusal reaches the composer once the new texts show,
    // after one attempt rather than the query's retries. A failure stays on
    // the query, where the composer reads it.
    onError: async (thrown, input) => {
      if (staffTextConflict(thrown) === null) return;
      const query = params.query(input.id);
      await queryClient.cancelQueries({
        queryKey: query.queryKey,
        exact: true,
      });
      await queryClient
        .fetchQuery({
          ...query,
          staleTime: 0,
          retry: false,
        })
        .catch(() => {});
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
    newestTextId: () =>
      maxBy(
        queryClient.getQueryData(queryKey(id))?.messages ?? [],
        (message) => message.id,
      )?.id ?? null,
    threadLoadFailed: () =>
      queryClient.getQueryState(queryKey(id))?.status === "error",
    send: (body: string, afterId: number | null) =>
      send.mutateAsync({ id, body, afterId }),
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
  const thread = useQuery({
    ...numberThreadQuery(threadId),
    refetchInterval: usePollInterval(milliseconds({ seconds: 10 })),
  });
  const actions = useThreadActions({
    id: threadId,
    query: numberThreadQuery,
    sendText: (input) =>
      mmsThreadSendInThreadAdmin({
        path: { threadId: input.id },
        body: { body: input.body, afterId: input.afterId },
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

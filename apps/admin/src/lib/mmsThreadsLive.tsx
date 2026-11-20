import {
  type Composer,
  composersSchema,
  type ComposingMessage,
  MmsThreadsEvent,
  threadChangedSchema,
} from "@alliance/common/mmsThreads";
import type {
  MmsThreadDto,
  NumberThreadDto,
} from "@alliance/shared/client/types.gen";
import { refreshSession } from "@alliance/shared/lib/hey-api";
import { connectMessagingSocket } from "@alliance/shared/lib/messagingSocket";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { isRefused } from "@alliance/shared/lib/retryQuery";
import {
  focusManager,
  type Query,
  type QueryClient,
  type QueryFilters,
  useQueryClient,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { throttle } from "es-toolkit";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getWebSocketUrl } from "./config";

type MmsThreadsLive = {
  /** While false, pushes may be missed, so queries poll at their usual rate. */
  connected: boolean;
  /** Other admins composing a text, one entry per admin and number. */
  composers: Composer[];
  reportComposing: (phoneNumber: string) => void;
  stopComposing: (phoneNumber: string) => void;
};

export const OFFLINE: MmsThreadsLive = {
  connected: false,
  composers: [],
  reportComposing: () => {},
  stopComposing: () => {},
};

export const MmsThreadsLiveContext = createContext<MmsThreadsLive>(OFFLINE);

export const useMmsThreadsLive = () => useContext(MmsThreadsLiveContext);

// A burst of replies to a broadcast would otherwise refetch each list once
// per text in every tab.
export const LIST_REFETCH_MS = milliseconds({ seconds: 5 });

// A change joins a fetch in flight, whose response may predate it, and fetches
// once more after it settles, however many changes arrive meanwhile.
// Restarting the fetch on each change instead would apply nothing through a
// stream of changes faster than one fetch.
const refetchingAfterFetch = new WeakSet<Query>();

// A hidden tab's queries are only marked stale, and refetch when it's shown.
const refetchType = () => (focusManager.isFocused() ? "active" : "none");

function refetchFresh(queryClient: QueryClient, filters: QueryFilters): void {
  for (const query of queryClient
    .getQueryCache()
    .findAll({ ...filters, type: "active", fetchStatus: "fetching" })) {
    if (refetchingAfterFetch.has(query)) continue;
    refetchingAfterFetch.add(query);
    const refetch = () => {
      refetchingAfterFetch.delete(query);
      void queryClient.invalidateQueries({
        queryKey: query.queryKey,
        exact: true,
        refetchType: refetchType(),
      });
    };
    void query.promise?.then(refetch, refetch);
  }
  void queryClient.invalidateQueries(
    { ...filters, refetchType: refetchType() },
    { cancelRefetch: false },
  );
}

const THREAD_QUERIES = [
  queryKeys.memberTextThreadsAdminAll(),
  queryKeys.numberTextThreadsAdminAll(),
];

/** Member and number threads showing `phoneNumber`, and those with no data
 * yet, whose number is unknown, unless the server refused their load. */
export function refetchChangedThread(
  queryClient: QueryClient,
  phoneNumber: string,
): void {
  for (const queryKey of THREAD_QUERIES) {
    for (const [key, thread] of queryClient.getQueriesData<
      Pick<MmsThreadDto | NumberThreadDto, "phoneNumber">
    >({ queryKey })) {
      if (
        thread === undefined
          ? !isRefused(queryClient.getQueryState(key)?.error)
          : thread.phoneNumber === phoneNumber
      ) {
        refetchFresh(queryClient, { queryKey: key, exact: true });
      }
    }
  }
}

type PushSource = {
  on(event: string, listener: (data: unknown) => void): unknown;
};

/** A (re)connect refetches every thread, Needs reply and the Texts list,
 * since pushes may have been missed while disconnected. */
export function listenToMmsThreads(params: {
  socket: PushSource;
  queryClient: QueryClient;
  /** The signed-in admin, left out of the composers. */
  ownId: number;
  setConnected: (connected: boolean) => void;
  setComposers: (composers: Composer[]) => void;
}): void {
  const { socket, queryClient, ownId, setConnected, setComposers } = params;
  const throttledRefetch = (queryKey: readonly unknown[]) =>
    throttle(() => refetchFresh(queryClient, { queryKey }), LIST_REFETCH_MS);
  const refetchNeedsReply = throttledRefetch(queryKeys.needsReplyAdmin());
  const refetchTextsList = throttledRefetch(queryKeys.textThreadsAdminAll());
  socket.on("connect", () => {
    setConnected(true);
    for (const queryKey of [
      ...THREAD_QUERIES,
      queryKeys.needsReplyAdmin(),
      queryKeys.textThreadsAdminAll(),
    ]) {
      refetchFresh(queryClient, { queryKey });
    }
  });
  socket.on("disconnect", () => {
    setConnected(false);
    setComposers([]);
  });
  socket.on(MmsThreadsEvent.Composing, (data) =>
    setComposers(
      composersSchema.parse(data).filter((c) => c.adminId !== ownId),
    ),
  );
  socket.on(MmsThreadsEvent.ThreadChanged, (data) => {
    const { phoneNumber, needsReplyChanged } = threadChangedSchema.parse(data);
    if (needsReplyChanged) refetchNeedsReply();
    refetchTextsList();
    refetchChangedThread(queryClient, phoneNumber);
  });
}

/** One `/mms-threads` socket per tab. */
export function MmsThreadsLiveProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  // Waits for sign-in, whose bootstrap refreshes a lapsed access cookie.
  const ownId = useAuth().user?.id;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [composers, setComposers] = useState<Composer[]>([]);

  useEffect(() => {
    if (ownId === undefined) return;
    const { socket: next, close } = connectMessagingSocket("/mms-threads", {
      getWebSocketUrl,
      onRefreshToken: refreshSession,
    });
    listenToMmsThreads({
      socket: next,
      queryClient,
      ownId,
      setConnected,
      setComposers,
    });
    setSocket(next);
    return () => {
      close();
      setSocket(null);
      setConnected(false);
      setComposers([]);
    };
  }, [queryClient, ownId]);

  // Stable while the socket is, so a composer's cleanup doesn't run whenever
  // someone else starts composing.
  const actions = useMemo(
    (): Pick<MmsThreadsLive, "reportComposing" | "stopComposing"> => ({
      reportComposing: (phoneNumber) =>
        socket?.volatile.emit(MmsThreadsEvent.Composing, {
          phoneNumber,
        } satisfies ComposingMessage),
      stopComposing: (phoneNumber) =>
        socket?.emit(MmsThreadsEvent.StoppedComposing, {
          phoneNumber,
        } satisfies ComposingMessage),
    }),
    [socket],
  );
  const value = useMemo(
    (): MmsThreadsLive => ({ connected, composers, ...actions }),
    [connected, composers, actions],
  );

  return (
    <MmsThreadsLiveContext.Provider value={value}>
      {children}
    </MmsThreadsLiveContext.Provider>
  );
}

export function useComposerNames(phoneNumber: string): string[] {
  const { composers } = useMmsThreadsLive();
  return composers
    .filter((c) => c.phoneNumber === phoneNumber)
    .map((c) => c.adminName);
}

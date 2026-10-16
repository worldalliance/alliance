import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  type ConversationDto,
  conversationGetMyConversations,
} from "../client";
import { sortConversations } from "./conversations";
import { queryKeys } from "./queryKeys";

type ConversationsUpdate = (
  prev: ConversationDto[] | null,
) => ConversationDto[] | null;

// A reload may read the list before a write lands, so each write made while
// a reload is in flight is replayed over that reload's result.
const writesDuringReloads = new WeakMap<
  QueryClient,
  Set<ConversationsUpdate[]>
>();

const reloadsOf = (queryClient: QueryClient) => {
  const reloads = writesDuringReloads.get(queryClient) ?? new Set();
  writesDuringReloads.set(queryClient, reloads);
  return reloads;
};

// A write through setQueryData clears the query's error, so whether the
// latest reload failed is judged against the last reload that succeeded.
const lastLoadedAt = new WeakMap<QueryClient, number>();

/** The viewer's conversations, shared by every screen that lists or opens
 * one, and every write to that list. */
export function useMyConversations() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.myConversations(),
    queryFn: async () => {
      const writes: ConversationsUpdate[] = [];
      const reloads = reloadsOf(queryClient);
      reloads.add(writes);
      try {
        const { data } = await conversationGetMyConversations({
          throwOnError: true,
        }).catch((error: unknown) => {
          console.error("Failed to load conversations", error);
          throw error;
        });
        lastLoadedAt.set(queryClient, Date.now());
        return writes.reduce(
          (list, update) => update(list) ?? list,
          data.sort(sortConversations),
        );
      } finally {
        reloads.delete(writes);
      }
    },
    // Sockets keep the list current only while a messaging screen is open.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const setConversations = useCallback(
    (update: ConversationsUpdate) => {
      for (const writes of reloadsOf(queryClient)) writes.push(update);
      queryClient.setQueryData<ConversationDto[]>(
        queryKeys.myConversations(),
        (prev) => update(prev ?? null) ?? undefined,
      );
    },
    [queryClient],
  );

  const { refetch } = query;
  const refreshConversations = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    conversations: query.data ?? null,
    loading: query.isFetching,
    reloadFailed:
      query.data !== undefined &&
      query.errorUpdatedAt > (lastLoadedAt.get(queryClient) ?? 0),
    setConversations,
    refreshConversations,
  };
}

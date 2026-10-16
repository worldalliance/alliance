import { type Result } from "@alliance/common/result";
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  conversationAddParticipant,
  type ConversationDto,
  conversationGetMyConversations,
  conversationLeave,
  conversationRemoveParticipant,
  conversationUpdateInfo,
  type UpdateConversationDto,
} from "../client";
import { mergeConversationUpdate, sortConversations } from "./conversations";
import { queryKeys } from "./queryKeys";
import { type Explanation, sendOrExplain } from "./sendOrExplain";

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
 * one, and every write to that list. A screen that only writes passes
 * `load: false` so mounting it doesn't reload the list. */
export function useMyConversations({ load = true }: { load?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.myConversations(),
    enabled: load,
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

  const storeConversation = (
    sent: Result<ConversationDto, Explanation>,
  ): Result<ConversationDto, Explanation> => {
    if (sent.ok) {
      setConversations((prev) => mergeConversationUpdate(prev, sent.value));
    }
    return sent;
  };

  const updateInfo = async (
    conversationId: number,
    body: UpdateConversationDto,
  ) =>
    storeConversation(
      await sendOrExplain({
        send: conversationUpdateInfo,
        options: { path: { conversationId }, body },
        action: "save the group",
      }),
    );

  const addParticipant = async (params: {
    conversationId: number;
    userId: number;
  }) =>
    storeConversation(
      await sendOrExplain({
        send: conversationAddParticipant,
        options: {
          path: { conversationId: params.conversationId },
          body: { userId: params.userId },
        },
        action: "add that member",
      }),
    );

  const removeParticipant = async (params: {
    conversationId: number;
    userId: number;
  }) =>
    storeConversation(
      await sendOrExplain({
        send: conversationRemoveParticipant,
        options: { path: params },
        action: "remove that member",
      }),
    );

  const leave = async (conversationId: number) => {
    const left = await sendOrExplain({
      send: conversationLeave,
      options: { path: { conversationId } },
      action: "leave the group",
    });
    if (left.ok) {
      setConversations(
        (prev) => prev?.filter(({ id }) => id !== conversationId) ?? null,
      );
    }
    return left;
  };

  return {
    conversations: query.data ?? null,
    loading: query.isFetching,
    reloadFailed:
      query.data !== undefined &&
      query.errorUpdatedAt > (lastLoadedAt.get(queryClient) ?? 0),
    setConversations,
    refreshConversations,
    updateInfo,
    addParticipant,
    removeParticipant,
    leave,
  };
}

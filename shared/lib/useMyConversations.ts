import { type Result } from "@alliance/common/result";
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  conversationAcceptInvite,
  conversationAddParticipant,
  conversationCreateDirectConversation,
  conversationCreateGroupConversation,
  conversationDeclineInvite,
  type ConversationDto,
  conversationGetMyConversations,
  conversationLeave,
  conversationMarkRead,
  conversationRemoveParticipant,
  conversationUpdateInfo,
  type CreateGroupConversationDto,
  type UpdateConversationDto,
} from "../client";
import { mergeConversationUpdate, sortConversations } from "./conversations";
import { queryKeys } from "./queryKeys";
import { type Explanation, sendOrExplain } from "./sendOrExplain";
import { writesDuringLoads } from "./writesDuringLoads";

type ConversationsUpdate = (
  prev: ConversationDto[] | null,
) => ConversationDto[] | null;

const reloads = writesDuringLoads<ConversationDto[]>();

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
    queryFn: () =>
      reloads.load({
        queryClient,
        queryKey: queryKeys.myConversations(),
        fetch: async () => {
          const { data } = await conversationGetMyConversations({
            throwOnError: true,
          }).catch((error: unknown) => {
            console.error("Failed to load conversations", error);
            throw error;
          });
          lastLoadedAt.set(queryClient, Date.now());
          return data.sort(sortConversations);
        },
      }),
    // Sockets keep the list current only while a messaging screen is open.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const setConversations = useCallback(
    (update: ConversationsUpdate) => {
      reloads.record({
        queryClient,
        queryKey: queryKeys.myConversations(),
        update: (list) => update(list) ?? list,
      });
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

  const storeCreated = (
    sent: Result<ConversationDto, Explanation>,
  ): Result<ConversationDto, Explanation> => {
    if (sent.ok) {
      setConversations((prev) =>
        [
          sent.value,
          ...(prev ?? []).filter(({ id }) => id !== sent.value.id),
        ].sort(sortConversations),
      );
    }
    return sent;
  };

  const createDirectConversation = async (targetUserId: number) =>
    storeCreated(
      await sendOrExplain({
        send: conversationCreateDirectConversation,
        options: { body: { targetUserId } },
        action: "start the chat",
      }),
    );

  const createGroupConversation = async (body: CreateGroupConversationDto) =>
    storeCreated(
      await sendOrExplain({
        send: conversationCreateGroupConversation,
        options: { body },
        action: "start the group chat",
      }),
    );

  const acceptInvite = async (conversationId: number) =>
    storeConversation(
      await sendOrExplain({
        send: conversationAcceptInvite,
        options: { path: { conversationId } },
        action: "accept the request",
      }),
    );

  const declineInvite = async (conversationId: number) =>
    storeConversation(
      await sendOrExplain({
        send: conversationDeclineInvite,
        options: { path: { conversationId } },
        action: "decline the request",
      }),
    );

  const markRead = useCallback(
    (conversationId: number) =>
      sendOrExplain({
        send: conversationMarkRead,
        options: { path: { conversationId } },
        action: "mark the chat read",
      }),
    [],
  );

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
    createDirectConversation,
    createGroupConversation,
    acceptInvite,
    declineInvite,
    markRead,
    updateInfo,
    addParticipant,
    removeParticipant,
    leave,
  };
}

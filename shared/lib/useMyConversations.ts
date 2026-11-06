import { type Result } from "@alliance/common/result";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
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
  type MessageDto,
  type UpdateConversationDto,
} from "../client";
import { conversationStore, selectConversation } from "./conversationStore";
import { sortConversations } from "./conversations";
import { queryKeys } from "./queryKeys";
import { type Explanation, sendOrExplain } from "./sendOrExplain";
import { currentSession } from "./sessionStores";
import { useEntityList } from "./useEntityList";
import { refreshUnreadMessageCount } from "./useUnreadMessageCount";

// A write through setQueryData clears the query's error, so whether the
// latest reload failed is judged against the last reload that succeeded.
const lastLoadedAt = new WeakMap<QueryClient, number>();

/** The viewer's conversations, shared by every screen that lists or opens
 * one, and every write to a conversation. A screen that only writes passes
 * `load: false` so mounting it doesn't reload the list. */
export function useMyConversations({ load = true }: { load?: boolean } = {}) {
  const queryClient = useQueryClient();
  const store = conversationStore(queryClient);
  const query = useEntityList({
    store: conversationStore,
    select: selectConversation,
    queryKey: queryKeys.myConversations(),
    enabled: load,
    load: ({ store, signal }) =>
      store.load({
        signal,
        fetch: async () => {
          const { data } = await conversationGetMyConversations({
            throwOnError: true,
            signal,
          }).catch((error: unknown) => {
            console.error("Failed to load conversations", error);
            throw error;
          });
          lastLoadedAt.set(queryClient, Date.now());
          return { conversations: data, isViewerList: true };
        },
      }),
    // Sockets keep the list current only while a messaging screen is open.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const conversations = useMemo(
    () => (query.data ? [...query.data].sort(sortConversations) : null),
    [query.data],
  );

  const { refetch } = query;
  const refreshConversations = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const storeConversation = useCallback(
    (conversation: ConversationDto) =>
      store.saved({ session: currentSession(queryClient), conversation }),
    [queryClient, store],
  );

  const storeLastMessage = useCallback(
    (message: MessageDto) =>
      store.messageReceived({ session: currentSession(queryClient), message }),
    [queryClient, store],
  );

  const send = async (params: {
    sent: () => Promise<Result<ConversationDto, Explanation>>;
    store: (params: { session: number; conversation: ConversationDto }) => void;
  }) => {
    const session = currentSession(queryClient);
    const sent = await params.sent();
    if (sent.ok) params.store({ session, conversation: sent.value });
    return sent;
  };

  const createDirectConversation = (targetUserId: number) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationCreateDirectConversation,
          options: { body: { targetUserId } },
          action: "start the chat",
        }),
      store: store.listed,
    });

  const createGroupConversation = (body: CreateGroupConversationDto) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationCreateGroupConversation,
          options: { body },
          action: "start the group chat",
        }),
      store: store.listed,
    });

  const acceptInvite = (conversationId: number) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationAcceptInvite,
          options: { path: { conversationId } },
          action: "accept the request",
        }),
      store: store.saved,
    });

  // The decliner and leaver are no longer participants, so the server
  // neither lists the conversation for them nor announces the change to them
  // over the overview socket.
  const departed = async (params: {
    conversationId: number;
    send: () => Promise<Result<unknown, Explanation>>;
  }) => {
    const session = currentSession(queryClient);
    const sent = await params.send();
    if (sent.ok) {
      void refreshUnreadMessageCount(queryClient);
      store.dropped({ session, conversationId: params.conversationId });
    }
    return sent;
  };

  const declineInvite = (conversationId: number) =>
    departed({
      conversationId,
      send: () =>
        sendOrExplain({
          send: conversationDeclineInvite,
          options: { path: { conversationId } },
          action: "decline the request",
        }),
    });

  const leave = (conversationId: number) =>
    departed({
      conversationId,
      send: () =>
        sendOrExplain({
          send: conversationLeave,
          options: { path: { conversationId } },
          action: "leave the group",
        }),
    });

  const markRead = useCallback(
    async (conversationId: number) => {
      const session = currentSession(queryClient);
      const sent = await sendOrExplain({
        send: conversationMarkRead,
        options: { path: { conversationId } },
        action: "mark the chat read",
      });
      if (sent.ok) store.read({ session, conversation: sent.value });
      return sent;
    },
    [queryClient, store],
  );

  const updateInfo = (conversationId: number, body: UpdateConversationDto) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationUpdateInfo,
          options: { path: { conversationId }, body },
          action: "save the group",
        }),
      store: store.saved,
    });

  const addParticipant = (params: { conversationId: number; userId: number }) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationAddParticipant,
          options: {
            path: { conversationId: params.conversationId },
            body: { userId: params.userId },
          },
          action: "add that member",
        }),
      store: store.saved,
    });

  const removeParticipant = (params: {
    conversationId: number;
    userId: number;
  }) =>
    send({
      sent: () =>
        sendOrExplain({
          send: conversationRemoveParticipant,
          options: { path: params },
          action: "remove that member",
        }),
      store: store.saved,
    });

  return {
    conversations,
    loading: query.isFetching,
    reloadFailed:
      query.data !== undefined &&
      query.errorUpdatedAt > (lastLoadedAt.get(queryClient) ?? 0),
    refreshConversations,
    storeConversation,
    storeLastMessage,
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

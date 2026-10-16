import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { messageGetMessages, type MessageDto } from "../client";
import { queryKeys } from "./queryKeys";
import { writesDuringLoads } from "./writesDuringLoads";

type MessagesUpdate = (prev: MessageDto[]) => MessageDto[];

const loads = writesDuringLoads<MessageDto[]>();

const conversationOfUnconfirmed = new Map<string, number>();

/** The messages of one conversation, shared by every screen that shows it,
 * and every write to them. */
export function useConversationMessages(conversationId: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.conversationMessages(conversationId),
    queryFn:
      conversationId === null
        ? skipToken
        : () =>
            loads.load({
              queryClient,
              queryKey: queryKeys.conversationMessages(conversationId),
              fetch: () =>
                messageGetMessages({
                  path: { conversationId },
                  throwOnError: true,
                }).then(
                  ({ data }) => data,
                  // Shown as an empty conversation, which messages heard
                  // meanwhile still land on.
                  (error: unknown) => {
                    console.error("Failed to load messages", error);
                    return [];
                  },
                ),
            }),
    // The socket keeps the messages current only while a screen shows them.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const updateMessages = useCallback(
    (params: { conversationId: number; update: MessagesUpdate }) => {
      const { update } = params;
      const queryKey = queryKeys.conversationMessages(params.conversationId);
      loads.record({ queryClient, queryKey, update });
      queryClient.setQueryData<MessageDto[]>(
        queryKey,
        (prev) => prev && update(prev),
      );
    },
    [queryClient],
  );

  /** Adds a message heard over the socket, in place of the viewer's oldest
   * unconfirmed message when the viewer wrote it. Returns false for a
   * message already shown. */
  const receiveMessage = useCallback(
    (incoming: MessageDto) => {
      const shown = queryClient
        .getQueryData<
          MessageDto[]
        >(queryKeys.conversationMessages(incoming.conversationId))
        ?.some(({ id }) => id === incoming.id);
      if (shown) return false;
      updateMessages({
        conversationId: incoming.conversationId,
        update: (prev) => {
          if (prev.some(({ id }) => id === incoming.id)) return prev;
          const unconfirmed = prev.find(
            (message) =>
              message.id.startsWith("temp-") &&
              message.author.id === incoming.author.id,
          );
          if (unconfirmed) conversationOfUnconfirmed.delete(unconfirmed.id);
          return [
            ...prev.filter((message) => message !== unconfirmed),
            incoming,
          ];
        },
      });
      return true;
    },
    [queryClient, updateMessages],
  );

  const addOptimisticMessage = useCallback(
    (message: MessageDto) => {
      conversationOfUnconfirmed.set(message.id, message.conversationId);
      // Not replayed over a load, which may already hold the sent copy that
      // would replace this one.
      queryClient.setQueryData<MessageDto[]>(
        queryKeys.conversationMessages(message.conversationId),
        (prev) => [...(prev ?? []), message],
      );
    },
    [queryClient],
  );

  const removeOptimisticMessage = useCallback(
    (tempId: string) => {
      const conversationId = conversationOfUnconfirmed.get(tempId);
      conversationOfUnconfirmed.delete(tempId);
      if (conversationId === undefined) return;
      queryClient.setQueryData<MessageDto[]>(
        queryKeys.conversationMessages(conversationId),
        (prev) => prev?.filter(({ id }) => id !== tempId),
      );
    },
    [queryClient],
  );

  return {
    messages: query.data ?? null,
    receiveMessage,
    addOptimisticMessage,
    removeOptimisticMessage,
  };
}

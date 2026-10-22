import { type Result } from "@alliance/common/result";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  type CreateMessageDto,
  type MessageDto,
  messageGetMessages,
  messageSendMessage,
  type ProfileDto,
} from "../client";
import { queryKeys } from "./queryKeys";
import { type Explanation, sendOrExplain } from "./sendOrExplain";
import { writesDuringLoads } from "./writesDuringLoads";

type MessagesUpdate = (prev: MessageDto[]) => MessageDto[];

const loads = writesDuringLoads<MessageDto[]>();

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
                  // Shown as an empty conversation, which messages heard or
                  // sent meanwhile still land on.
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
    (params: {
      conversationId: number;
      update: MessagesUpdate;
      showBeforeLoad?: boolean;
    }) => {
      const { update } = params;
      const queryKey = queryKeys.conversationMessages(params.conversationId);
      loads.record({ queryClient, queryKey, update });
      queryClient.setQueryData<MessageDto[]>(queryKey, (prev) =>
        prev || params.showBeforeLoad ? update(prev ?? []) : undefined,
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

  /** Sends a message. Given the viewer's profile, shows it unconfirmed until
   * its sent copy is shown, and removes it if the send fails. */
  const sendMessage = useCallback(
    async (params: {
      message: CreateMessageDto;
      author?: ProfileDto;
    }): Promise<Result<MessageDto, Explanation>> => {
      const { message, author } = params;
      const { conversationId } = message;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      if (author) {
        updateMessages({
          conversationId,
          showBeforeLoad: true,
          update: (prev) => [
            ...prev,
            {
              id: tempId,
              body: message.body,
              attachments: message.attachments ?? [],
              createdAt: new Date().toISOString(),
              deletedAt: null,
              author,
              conversationId,
              replyTo: prev.find(({ id }) => id === message.replyToId),
            },
          ],
        });
      }
      const sent = await sendOrExplain({
        send: messageSendMessage,
        options: { body: message },
        action: "send the message",
      });
      if (author) {
        updateMessages({
          conversationId,
          update: (prev) =>
            !sent.ok || prev.some(({ id }) => id === sent.value.id)
              ? prev.filter(({ id }) => id !== tempId)
              : prev,
        });
      }
      return sent;
    },
    [updateMessages],
  );

  return {
    messages: query.data ?? null,
    receiveMessage,
    sendMessage,
  };
}

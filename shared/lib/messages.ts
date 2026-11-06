import type { ConversationDto, MessageDto } from "@alliance/shared/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { conversationStore } from "./conversationStore";
import {
  connectMessagingSocket,
  type MessagingConnectionConfig,
} from "./messagingSocket";
import { currentSession } from "./sessionStores";
import { useConversationMessages } from "./useConversationMessages";
import { useMyConversations } from "./useMyConversations";
import { useUnreadMessageCount } from "./useUnreadMessageCount";

type ConversationUnreadPayload = { conversation: ConversationDto };

export type UseLiveConvoMessagesResult = Pick<
  ReturnType<typeof useConversationMessages>,
  "messages" | "sendMessage"
>;

export const createMessagingHooks = (config: MessagingConnectionConfig) => {
  // Every mounted screen's socket writes the same records, so each must zero
  // the unread count of any conversation a screen has open.
  const openConversations = new Map<number, number>();

  const useConversations = (activeConversationId?: number | null) => {
    const queryClient = useQueryClient();
    const myConversations = useMyConversations();

    useEffect(() => {
      if (activeConversationId == null) return;
      const id = activeConversationId;
      openConversations.set(id, (openConversations.get(id) ?? 0) + 1);
      return () => {
        const screens = (openConversations.get(id) ?? 1) - 1;
        if (screens > 0) openConversations.set(id, screens);
        else openConversations.delete(id);
      };
    }, [activeConversationId]);

    useEffect(() => {
      let cancelled = false;
      let socket: Socket | null = null;
      let close: (() => void) | undefined;

      (async () => {
        if (cancelled) return;
        ({ socket, close } = connectMessagingSocket(
          "/messaging/overview",
          config,
        ));

        socket.on(
          "conversation:unread",
          ({ conversation }: ConversationUnreadPayload) => {
            conversationStore(queryClient).listed({
              session: currentSession(queryClient),
              conversation: openConversations.has(conversation.id)
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            });
          },
        );

        socket.on("messaging:error", (error) => {
          console.error("Messaging overview socket error", error);
        });
      })();

      return () => {
        cancelled = true;
        close?.();
      };
    }, [config, queryClient]);

    return myConversations;
  };

  const useLiveConvoMessages = (
    conversationId: number | null,
  ): UseLiveConvoMessagesResult => {
    const { messages, receiveMessage, sendMessage } =
      useConversationMessages(conversationId);
    const { markRead, storeConversation, storeLastMessage } =
      useMyConversations({ load: false });
    const socketRef = useRef<Socket | null>(null);
    const joinedConversationRef = useRef<number | null>(null);
    const activeConversationRef = useRef<number | null>(conversationId);
    useEffect(() => {
      let cancelled = false;
      let socket: Socket | null = null;
      let close: (() => void) | undefined;

      (async () => {
        if (cancelled) return;

        ({ socket, close } = connectMessagingSocket("/messaging", config));
        socketRef.current = socket;

        socket.on("message:new", (incoming: MessageDto) => {
          if (incoming.conversationId !== activeConversationRef.current) {
            return;
          }

          if (!receiveMessage(incoming)) {
            return;
          }

          storeLastMessage(incoming);

          void markRead(incoming.conversationId);
        });

        socket.on("conversation:updated", storeConversation);

        socket.on("connect", () => {
          if (activeConversationRef.current) {
            socket?.emit("join-conversation", {
              conversationId: activeConversationRef.current,
            });
            joinedConversationRef.current = activeConversationRef.current;
          }
        });

        socket.on("messaging:error", (error) => {
          console.error("Messaging socket error", error);
        });
      })();

      return () => {
        cancelled = true;
        close?.();
        socketRef.current = null;
        joinedConversationRef.current = null;
      };
    }, [config, receiveMessage, markRead, storeConversation, storeLastMessage]);

    useEffect(() => {
      activeConversationRef.current = conversationId;

      if (!conversationId) {
        if (socketRef.current && joinedConversationRef.current) {
          socketRef.current.emit("leave-conversation", {
            conversationId: joinedConversationRef.current,
          });
        }
        joinedConversationRef.current = null;
        return;
      }

      const socket = socketRef.current;
      if (socket) {
        if (
          joinedConversationRef.current &&
          joinedConversationRef.current !== conversationId
        ) {
          socket.emit("leave-conversation", {
            conversationId: joinedConversationRef.current,
          });
        }
        socket.emit("join-conversation", { conversationId });
        joinedConversationRef.current = conversationId;
      }

      return () => {
        if (
          socketRef.current &&
          joinedConversationRef.current === conversationId
        ) {
          socketRef.current.emit("leave-conversation", { conversationId });
          joinedConversationRef.current = null;
        }
      };
    }, [conversationId]);

    return { messages, sendMessage };
  };

  const useMessagingUnread = () => useUnreadMessageCount(config);

  return { useConversations, useLiveConvoMessages, useMessagingUnread };
};

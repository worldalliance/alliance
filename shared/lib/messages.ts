import type { ConversationDto, MessageDto } from "@alliance/shared/client";
import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import {
  type ConversationUnreadPayload,
  mergeConversationUnreadPayload,
} from "./conversations";
import {
  connectMessagingSocket,
  type MessagingConnectionConfig,
} from "./messagingSocket";
import { useConversationMessages } from "./useConversationMessages";
import { useMyConversations } from "./useMyConversations";
import { useUnreadMessageCount } from "./useUnreadMessageCount";

export interface UseLiveConvoMessagesOptions {
  onIncomingMessage?: (message: MessageDto) => void;
  onConversationUpdated?: (conversation: ConversationDto) => void;
}

export type UseLiveConvoMessagesResult = Pick<
  ReturnType<typeof useConversationMessages>,
  "messages" | "sendMessage"
>;

export const createMessagingHooks = (config: MessagingConnectionConfig) => {
  // Every mounted screen's socket merges into the one cached list, so each
  // must zero the unread count of any conversation a screen has open.
  const openConversations = new Map<number, number>();

  const useConversations = (activeConversationId?: number | null) => {
    const myConversations = useMyConversations();
    const { setConversations } = myConversations;

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
          (payload: ConversationUnreadPayload) => {
            setConversations((prev) =>
              mergeConversationUnreadPayload(
                prev,
                payload,
                openConversations.has(payload.conversationId)
                  ? payload.conversationId
                  : null,
              ),
            );
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
    }, [config, setConversations]);

    return myConversations;
  };

  const useLiveConvoMessages = (
    conversationId: number | null,
    options?: UseLiveConvoMessagesOptions,
  ): UseLiveConvoMessagesResult => {
    const { messages, receiveMessage, sendMessage } =
      useConversationMessages(conversationId);
    const { markRead } = useMyConversations({ load: false });
    const socketRef = useRef<Socket | null>(null);
    const joinedConversationRef = useRef<number | null>(null);
    const activeConversationRef = useRef<number | null>(conversationId);
    const handlersRef = useRef<UseLiveConvoMessagesOptions | undefined>(
      options,
    );

    useEffect(() => {
      handlersRef.current = options;
    }, [options]);

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

          handlersRef.current?.onIncomingMessage?.(incoming);

          void markRead(incoming.conversationId);
        });

        socket.on("conversation:updated", (conversation: ConversationDto) => {
          handlersRef.current?.onConversationUpdated?.(conversation);
        });

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
    }, [config, receiveMessage, markRead]);

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

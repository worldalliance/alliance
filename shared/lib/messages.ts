import {
  ConversationDto,
  conversationGetMyConversations,
  conversationGetUnreadSummary,
  conversationMarkRead,
  MessageDto,
  messageGetMessages,
} from "@alliance/shared/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import {
  type ConversationUnreadPayload,
  mergeConversationUnreadPayload,
  sortConversations,
} from "./conversations";
import {
  connectMessagingSocket,
  type MessagingConnectionConfig,
} from "./messagingSocket";

export interface UseLiveConvoMessagesOptions {
  onIncomingMessage?: (message: MessageDto) => void;
  onConversationUpdated?: (conversation: ConversationDto) => void;
}

export interface UseLiveConvoMessagesResult {
  messages: MessageDto[] | null;
  addOptimisticMessage: (message: MessageDto) => void;
  removeOptimisticMessage: (tempId: string) => void;
}

export const createMessagingHooks = (config: MessagingConnectionConfig) => {
  const useConversations = (activeConversationId?: number | null) => {
    const [conversations, setConversations] = useState<
      ConversationDto[] | null
    >(null);
    const [loading, setLoading] = useState(true);
    const activeConversationRef = useRef<number | null>(
      activeConversationId ?? null,
    );

    useEffect(() => {
      activeConversationRef.current = activeConversationId ?? null;
    }, [activeConversationId]);

    const refreshConversations = useCallback(async () => {
      setLoading(true);
      try {
        const response = await conversationGetMyConversations();
        if (response.data) {
          setConversations(response.data.sort(sortConversations));
        }
      } catch (error) {
        console.error("Failed to load conversations", error);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      let cancelled = false;
      refreshConversations().catch(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [refreshConversations]);

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
                activeConversationRef.current,
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
    }, [config]);

    return { conversations, setConversations, loading, refreshConversations };
  };

  const useLiveConvoMessages = (
    conversationId: number | null,
    options?: UseLiveConvoMessagesOptions,
  ): UseLiveConvoMessagesResult => {
    const [convoMessages, setConvoMessages] = useState<MessageDto[] | null>(
      null,
    );
    const socketRef = useRef<Socket | null>(null);
    const joinedConversationRef = useRef<number | null>(null);
    const activeConversationRef = useRef<number | null>(conversationId);
    const pendingMessagesRef = useRef<MessageDto[]>([]);
    const messageIdsRef = useRef<Set<string>>(new Set());
    const optimisticIdsRef = useRef<Set<string>>(new Set());
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

          if (messageIdsRef.current.has(incoming.id)) {
            return;
          }

          messageIdsRef.current.add(incoming.id);

          handlersRef.current?.onIncomingMessage?.(incoming);

          setConvoMessages((prev) => {
            if (!prev) {
              pendingMessagesRef.current.push(incoming);
              return prev;
            }
            const optimisticToRemove = prev.find(
              (msg) =>
                msg.id.startsWith("temp-") &&
                msg.author.id === incoming.author.id,
            );
            if (optimisticToRemove) {
              optimisticIdsRef.current.delete(optimisticToRemove.id);
              return prev
                .filter((msg) => msg.id !== optimisticToRemove.id)
                .concat(incoming);
            }
            return [...prev, incoming];
          });
          conversationMarkRead({
            path: { conversationId: incoming.conversationId },
          });
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
    }, [config]);

    useEffect(() => {
      activeConversationRef.current = conversationId;

      if (!conversationId) {
        setConvoMessages(null);
        if (socketRef.current && joinedConversationRef.current) {
          socketRef.current.emit("leave-conversation", {
            conversationId: joinedConversationRef.current,
          });
        }
        joinedConversationRef.current = null;
        return;
      }

      pendingMessagesRef.current = [];
      messageIdsRef.current = new Set();
      setConvoMessages(null);

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

      let cancelled = false;
      messageGetMessages({
        path: {
          conversationId,
        },
      })
        .then((response) => {
          if (cancelled) return;
          let initialMessages = response.data;
          if (!initialMessages) {
            console.error("Failed to load messages", response.error);
            initialMessages = [];
          }
          const ids = new Set(initialMessages.map((msg) => msg.id));
          messageIdsRef.current = ids;
          const pending = pendingMessagesRef.current.filter(
            (msg) => msg.conversationId === conversationId && !ids.has(msg.id),
          );
          pendingMessagesRef.current = [];
          setConvoMessages([...initialMessages, ...pending]);
        })
        .catch((error) => {
          console.error("Failed to load messages", error);
          setConvoMessages([]);
        });

      return () => {
        cancelled = true;
        if (
          socketRef.current &&
          joinedConversationRef.current === conversationId
        ) {
          socketRef.current.emit("leave-conversation", { conversationId });
          joinedConversationRef.current = null;
        }
      };
    }, [conversationId]);

    const addOptimisticMessage = useCallback((message: MessageDto) => {
      optimisticIdsRef.current.add(message.id);
      setConvoMessages((prev) => {
        if (!prev) {
          return [message];
        }
        return [...prev, message];
      });
    }, []);

    const removeOptimisticMessage = useCallback((tempId: string) => {
      optimisticIdsRef.current.delete(tempId);
      setConvoMessages((prev) => {
        if (!prev) return prev;
        return prev.filter((msg) => msg.id !== tempId);
      });
    }, []);

    return {
      messages: convoMessages,
      addOptimisticMessage,
      removeOptimisticMessage,
    };
  };

  const useMessagingUnread = () => {
    const [unread, setUnread] = useState<number>(0);
    const [hasUpdates, setHasUpdates] = useState<boolean>(false);
    const [updateTick, setUpdateTick] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    const refreshUnreadCount = useCallback(() => {
      conversationGetUnreadSummary()
        .then((res) => {
          if (res.data) {
            setUnread(res.data.totalCount);
            setHasUpdates(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load unread messages count", err);
        });
    }, []);

    useEffect(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount]);

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
        socketRef.current = socket;

        socket.on("conversation:unread", () => {
          setHasUpdates(true);
          setUpdateTick((tick) => tick + 1);
        });

        socket.on("messaging:error", (error) => {
          console.error("Messaging overview socket error", error);
        });
      })();

      return () => {
        cancelled = true;
        close?.();
        socketRef.current = null;
      };
    }, [config]);

    return {
      unread,
      refreshUnreadCount,
      hasUpdates,
      updateTick,
      setUnread,
      setHasUpdates,
    };
  };

  return { useConversations, useLiveConvoMessages, useMessagingUnread };
};

import {
  ConversationDto,
  conversationGetMyConversations,
  conversationGetUnreadMessages,
  conversationMarkRead,
  MessageDto,
  messageGetMessages,
} from "@alliance/shared/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getWebSocketUrl } from "../../lib/config";

type ConversationUnreadPayload = {
  conversationId: number;
  unreadCount: number;
  lastMessage?: MessageDto;
  conversation?: ConversationDto;
};

interface UseLiveConvoMessagesOptions {
  onIncomingMessage?: (message: MessageDto) => void;
  onConversationUpdated?: (conversation: ConversationDto) => void;
}

export const sortConversations = (
  a: ConversationDto,
  b: ConversationDto
): number => {
  return (
    new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() -
    new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime()
  );
};

export const useConversations = (activeConversationId?: number | null) => {
  const [conversations, setConversations] = useState<ConversationDto[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const activeConversationRef = useRef<number | null>(
    activeConversationId ?? null
  );

  useEffect(() => {
    activeConversationRef.current = activeConversationId ?? null;
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;
    conversationGetMyConversations()
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          setConversations(response.data.sort(sortConversations));
        }
      })
      .catch((error) => {
        console.error("Failed to load conversations", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = io(`${getWebSocketUrl()}/messaging/overview`, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on("conversation:unread", (payload: ConversationUnreadPayload) => {
      setConversations((prev) => {
        const isActive =
          activeConversationRef.current === payload.conversationId;

        const mergePayload = (
          base: ConversationDto | undefined | null
        ): ConversationDto | undefined => {
          if (!base && !payload.conversation) return undefined;
          const mergedBase = base ?? payload.conversation!;
          return {
            ...mergedBase,
            ...(payload.conversation ?? {}),
            lastMessage:
              payload.lastMessage ??
              payload.conversation?.lastMessage ??
              mergedBase.lastMessage,
            unreadCount: isActive
              ? 0
              : payload.unreadCount ??
                payload.conversation?.unreadCount ??
                mergedBase.unreadCount,
          };
        };

        if (!prev) {
          const merged = mergePayload(null);
          return merged ? [merged] : prev;
        }

        const existingIndex = prev.findIndex(
          (conversation) => conversation.id === payload.conversationId
        );
        if (existingIndex === -1) {
          const merged = mergePayload(payload.conversation ?? null);
          if (!merged) return prev;
          const updated = [merged, ...prev];
          return updated.sort(sortConversations);
        }

        const existing = prev[existingIndex];
        const merged = mergePayload(existing);
        if (!merged) return prev;

        const updated = [
          merged,
          ...prev.filter((c) => c.id !== payload.conversationId),
        ];
        return updated.sort(sortConversations);
      });
    });

    socket.on("messaging:error", (error) => {
      console.error("Messaging overview socket error", error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { conversations, setConversations, loading };
};

interface UseLiveConvoMessagesResult {
  messages: MessageDto[] | null;
  addOptimisticMessage: (message: MessageDto) => void;
  removeOptimisticMessage: (tempId: string) => void;
}

const useLiveConvoMessages = (
  conversationId: number | null,
  options?: UseLiveConvoMessagesOptions
): UseLiveConvoMessagesResult => {
  const [convoMessages, setConvoMessages] = useState<MessageDto[] | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const joinedConversationRef = useRef<number | null>(null);
  const activeConversationRef = useRef<number | null>(conversationId);
  const pendingMessagesRef = useRef<MessageDto[]>([]);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const optimisticIdsRef = useRef<Set<string>>(new Set());
  const handlersRef = useRef<UseLiveConvoMessagesOptions | undefined>(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  useEffect(() => {
    const socket = io(`${getWebSocketUrl()}/messaging`, {
      transports: ["websocket"],
      withCredentials: true,
    });

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
        // Check if there are any optimistic messages to replace from this user
        // When a real message comes in, replace the oldest optimistic message from the same author
        const optimisticToRemove = prev.find(
          (msg) => msg.id.startsWith("temp-") && msg.author.id === incoming.author.id
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
        socket.emit("join-conversation", {
          conversationId: activeConversationRef.current,
        });
        joinedConversationRef.current = activeConversationRef.current;
      }
    });

    socket.on("messaging:error", (error) => {
      console.error("Messaging socket error", error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedConversationRef.current = null;
    };
  }, []);

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
          (msg) => msg.conversationId === conversationId && !ids.has(msg.id)
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

  return { messages: convoMessages, addOptimisticMessage, removeOptimisticMessage };
};

export default useLiveConvoMessages;

interface UnreadPayload {
  conversationId: number;
  unreadCount: number;
}

/**
 * Lightweight unread counter for messaging; listens for overview socket updates
 * and increments/decrements local unread count without loading conversation lists.
 */
const useMessagingUnread = (activeConversationId?: number | null) => {
  const [unread, setUnread] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const unreadByConversationRef = useRef<Map<number, number>>(new Map());
  const unknownUnreadRef = useRef<number>(0);
  const activeConversationRef = useRef<number | null>(
    activeConversationId ?? null
  );

  useEffect(() => {
    activeConversationRef.current =
      typeof activeConversationId === "number"
        ? activeConversationId
        : activeConversationId ?? null;
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;
    conversationGetUnreadMessages()
      .then((res) => {
        if (!cancelled) {
          const count = res.data?.count ?? 0;
          setUnread(count);
          unknownUnreadRef.current = count;
          unreadByConversationRef.current = new Map();
        }
      })
      .catch((err) => {
        console.error("Failed to load unread messages count", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = io(`${getWebSocketUrl()}/messaging/overview`, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("conversation:unread", (payload: UnreadPayload) => {
      const newCountRaw =
        typeof payload.unreadCount === "number" ? payload.unreadCount : null;

      if (newCountRaw === null) {
        return;
      }

      const newCount =
        activeConversationRef.current === payload.conversationId
          ? 0
          : newCountRaw;

      setUnread((prevTotal) => {
        const map = unreadByConversationRef.current;
        const prevForConvo = map.get(payload.conversationId);
        const wasTracked = prevForConvo !== undefined;
        const prevCount = prevForConvo ?? 0;

        map.set(payload.conversationId, newCount);

        const hadUnread = prevCount > 0;
        const hasUnread = newCount > 0;

        // Conversation wasn't tracked before and is now marked as read.
        // It was likely part of the "unknown" unread pool from initial load.
        if (!wasTracked && !hasUnread) {
          if (unknownUnreadRef.current > 0) {
            unknownUnreadRef.current = Math.max(
              unknownUnreadRef.current - 1,
              0
            );
            return Math.max(prevTotal - 1, 0);
          }
          return prevTotal;
        }

        if (!hadUnread && hasUnread) {
          if (unknownUnreadRef.current > 0) {
            unknownUnreadRef.current = Math.max(
              unknownUnreadRef.current - 1,
              0
            );
            return prevTotal;
          }
          return prevTotal + 1;
        }

        if (hadUnread && !hasUnread) {
          return Math.max(prevTotal - 1, 0);
        }

        return prevTotal;
      });
    });

    socket.on("messaging:error", (error) => {
      console.error("Messaging overview socket error", error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const clearUnread = () => {
    unreadByConversationRef.current.clear();
    unknownUnreadRef.current = 0;
    setUnread(0);
  };

  return { unread, setUnread, clearUnread };
};

export { useMessagingUnread };

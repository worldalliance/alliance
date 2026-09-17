import { conversationTypesWithEditableInfo } from "@alliance/common/conversationType";
import { rolesWithAdminPowers } from "@alliance/common/participantRole";
import {
  ConversationDto,
  conversationGetMyConversations,
  conversationGetUnreadSummary,
  conversationMarkRead,
  MessageDto,
  messageGetMessages,
} from "@alliance/shared/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type ConversationUnreadPayload = {
  conversationId: number;
  unreadCount: number;
  lastMessage?: MessageDto;
  conversation?: ConversationDto;
};

export type MessagingConnectionConfig = {
  getWebSocketUrl: () => string;
  getAuthToken?: () => Promise<string | null> | string | null;
  onRefreshToken?: () => Promise<string | null>;
};

export interface UseLiveConvoMessagesOptions {
  onIncomingMessage?: (message: MessageDto) => void;
  onConversationUpdated?: (conversation: ConversationDto) => void;
}

export interface UseLiveConvoMessagesResult {
  messages: MessageDto[] | null;
  addOptimisticMessage: (message: MessageDto) => void;
  removeOptimisticMessage: (tempId: string) => void;
}

export const sortConversations = (
  a: ConversationDto,
  b: ConversationDto,
): number => {
  return (
    new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() -
    new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime()
  );
};

export const getConversationTimestamp = (conversation: ConversationDto) => {
  return new Date(
    conversation.lastMessage?.createdAt ?? conversation.createdAt,
  );
};

export const getParticipantState = (
  conversation: ConversationDto | null | undefined,
  userId: number | null | undefined,
) => {
  if (!conversation || !userId) return null;
  return (
    conversation.participants.find(
      (participant) => participant.user.id === userId,
    )?.state ?? null
  );
};

export const isConversationAdmin = (
  conversation: ConversationDto | null | undefined,
  userId: number | null | undefined,
): boolean => {
  if (!conversation || !userId) return false;
  return conversation.participants.some(
    (participant) =>
      participant.user.id === userId && rolesWithAdminPowers[participant.role],
  );
};

export const canEditConversationInfo = (
  conversation: ConversationDto | null | undefined,
  userId: number | null | undefined,
): boolean =>
  !!conversation &&
  conversationTypesWithEditableInfo[conversation.type] &&
  isConversationAdmin(conversation, userId);

export const filterConversationsByParticipantState = (
  conversations: ConversationDto[] | null | undefined,
  userId: number | null | undefined,
  state: "joined" | "invited",
) => {
  if (!conversations || !userId) return undefined;
  return conversations.filter(
    (conversation) => getParticipantState(conversation, userId) === state,
  );
};

export const getJoinedConversations = (
  conversations: ConversationDto[] | null | undefined,
  userId: number | null | undefined,
) => {
  return filterConversationsByParticipantState(conversations, userId, "joined");
};

export const getPendingInvites = (
  conversations: ConversationDto[] | null | undefined,
  userId: number | null | undefined,
) => {
  return filterConversationsByParticipantState(
    conversations,
    userId,
    "invited",
  );
};

export const buildGroupConversationTitle = (names: string[]) => {
  const cleaned = names.filter((name) => name && name.trim().length > 0);
  if (cleaned.length <= 3) {
    return cleaned.join(", ");
  }
  return `${cleaned.slice(0, 3).join(", ")} +${cleaned.length - 3} more`;
};

export const findMatchingConversation = (
  conversations: ConversationDto[] | null | undefined,
  currentUserId: number | null | undefined,
  participantIds: number[],
): ConversationDto | null => {
  if (!conversations || !currentUserId || participantIds.length === 0) {
    return null;
  }

  const targetIds = new Set(participantIds);

  for (const conversation of conversations) {
    const usersWithoutCurrent = conversation.participants
      .filter((participant) => participant.user.id !== currentUserId)
      .map((participant) => participant.user.id);

    if (usersWithoutCurrent.length !== participantIds.length) {
      continue;
    }

    const matches = usersWithoutCurrent.every((id) => targetIds.has(id));
    if (!matches) {
      continue;
    }

    const isDirect =
      conversation.type === "direct" && usersWithoutCurrent.length === 1;
    const isGroup =
      conversation.type === "multiple" && usersWithoutCurrent.length > 1;

    if (isDirect || isGroup) {
      return conversation;
    }
  }

  return null;
};

export const getConversationPreview = (
  conversation: ConversationDto,
  currentUserId?: number | null,
) => {
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) {
    return "No messages yet";
  }

  if (conversation.type === "direct") {
    if (currentUserId && lastMessage.author.id === currentUserId) {
      return `you: ${lastMessage.body}`;
    }
    return lastMessage.body;
  }

  return `${lastMessage.author.displayName}: ${lastMessage.body}`;
};

export const getMessageRequestPreview = (conversation: ConversationDto) => {
  const lastMessage = conversation.lastMessage;
  if (lastMessage) {
    if (conversation.type === "direct") {
      return lastMessage.body;
    }
    return `${lastMessage.author.displayName}: ${lastMessage.body}`;
  }

  return conversation.type === "direct"
    ? "Wants to start a conversation"
    : "You were invited to a group";
};

export const updateConversationsForLastMessage = (
  conversations: ConversationDto[] | null,
  message: MessageDto,
) => {
  if (!conversations) return conversations;
  const existing = conversations.find(
    (conversation) => conversation.id === message.conversationId,
  );
  if (!existing) {
    return conversations;
  }
  const updated = { ...existing, lastMessage: message };
  return [
    updated,
    ...conversations.filter((conversation) => conversation.id !== updated.id),
  ];
};

export const mergeConversationUpdate = (
  conversations: ConversationDto[] | null,
  updatedConversation: ConversationDto,
) => {
  if (!conversations) {
    return conversations;
  }
  const existing = conversations.find(
    (conversation) => conversation.id === updatedConversation.id,
  );
  if (!existing) {
    return conversations;
  }
  const merged = { ...existing, ...updatedConversation };
  return [
    merged,
    ...conversations.filter((conversation) => conversation.id !== merged.id),
  ].sort(sortConversations);
};

export const mergeConversationUnreadPayload = (
  conversations: ConversationDto[] | null,
  payload: ConversationUnreadPayload,
  activeConversationId: number | null,
) => {
  const isActive = activeConversationId === payload.conversationId;

  const mergePayload = (
    base: ConversationDto | undefined | null,
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
        : (payload.unreadCount ??
          payload.conversation?.unreadCount ??
          mergedBase.unreadCount),
    };
  };

  if (!conversations) {
    const merged = mergePayload(null);
    return merged ? [merged] : conversations;
  }

  const existingIndex = conversations.findIndex(
    (conversation) => conversation.id === payload.conversationId,
  );
  if (existingIndex === -1) {
    const merged = mergePayload(payload.conversation ?? null);
    if (!merged) return conversations;
    const updated = [merged, ...conversations];
    return updated.sort(sortConversations);
  }

  const existing = conversations[existingIndex];
  const merged = mergePayload(existing);
  if (!merged) return conversations;

  const updated = [
    merged,
    ...conversations.filter(
      (conversation) => conversation.id !== payload.conversationId,
    ),
  ];
  return updated.sort(sortConversations);
};

const resolveAuthToken = async (
  getAuthToken?: () => Promise<string | null> | string | null,
) => {
  if (!getAuthToken) return null;
  try {
    const token = getAuthToken();
    if (token && typeof (token as Promise<string | null>).then === "function") {
      return await token;
    }
    return token ?? null;
  } catch (error) {
    console.error("Failed to resolve messaging auth token", error);
    return null;
  }
};

const buildSocketOptions = (
  getAuthToken?: () => Promise<string | null> | string | null,
) => {
  if (!getAuthToken) {
    return { transports: ["websocket"], withCredentials: true };
  }
  return {
    transports: ["websocket"],
    withCredentials: true,
    auth: async (cb: (data: Record<string, unknown>) => void) => {
      const token = await resolveAuthToken(getAuthToken);
      cb(token ? { token } : {});
    },
  };
};

const attachAuthRefresh = (
  socket: Socket,
  onRefreshToken?: () => Promise<string | null>,
) => {
  if (!onRefreshToken) return;
  let refreshing = false;
  socket.on("connect_error", async (err) => {
    if (refreshing) return;
    if (
      !err.message?.includes("jwt expired") &&
      !err.message?.includes("Unauthorized")
    ) {
      return;
    }
    refreshing = true;
    socket.disconnect(); // stop auto-reconnect from racing with the refresh
    try {
      const newToken = await onRefreshToken();
      if (newToken) {
        socket.auth = { token: newToken };
        socket.connect();
      }
    } catch (refreshErr) {
      console.error("Socket token refresh failed", refreshErr);
    } finally {
      refreshing = false;
    }
  });
};

export const createMessagingHooks = (config: MessagingConnectionConfig) => {
  const { getWebSocketUrl, getAuthToken, onRefreshToken } = config;

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

      (async () => {
        if (cancelled) return;
        socket = io(
          `${getWebSocketUrl()}/messaging/overview`,
          buildSocketOptions(getAuthToken),
        );
        attachAuthRefresh(socket, onRefreshToken);

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
        socket?.disconnect();
      };
    }, [getWebSocketUrl, getAuthToken]);

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

      (async () => {
        if (cancelled) return;

        socket = io(
          `${getWebSocketUrl()}/messaging`,
          buildSocketOptions(getAuthToken),
        );
        attachAuthRefresh(socket, onRefreshToken);
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
        socket?.disconnect();
        socketRef.current = null;
        joinedConversationRef.current = null;
      };
    }, [getWebSocketUrl, getAuthToken]);

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

      (async () => {
        if (cancelled) return;
        socket = io(
          `${getWebSocketUrl()}/messaging/overview`,
          buildSocketOptions(getAuthToken),
        );
        attachAuthRefresh(socket, onRefreshToken);
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
        socket?.disconnect();
        socketRef.current = null;
      };
    }, [getWebSocketUrl, getAuthToken]);

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

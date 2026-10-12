import {
  conversationTypesUsersCanLeave,
  conversationTypesWithEditableInfo,
  conversationTypesWithEditableMembers,
} from "@alliance/common/conversationType";
import { rolesWithAdminPowers } from "@alliance/common/participantRole";
import { ConversationDto, MessageDto } from "@alliance/shared/client";

export type ConversationUnreadPayload = {
  conversationId: number;
  unreadCount: number;
  lastMessage?: MessageDto;
  conversation?: ConversationDto;
};

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

export const canEditConversationMembers = (
  conversation: ConversationDto | null | undefined,
  userId: number | null | undefined,
): boolean =>
  !!conversation &&
  conversationTypesWithEditableMembers[conversation.type] &&
  isConversationAdmin(conversation, userId);

export const canLeaveConversation = (
  conversation: ConversationDto | null | undefined,
): boolean =>
  !!conversation && conversationTypesUsersCanLeave[conversation.type];

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

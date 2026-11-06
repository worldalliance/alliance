import {
  conversationTypesUsersCanLeave,
  conversationTypesWithEditableInfo,
  conversationTypesWithEditableMembers,
} from "@alliance/common/conversationType";
import { rolesWithAdminPowers } from "@alliance/common/participantRole";
import { ConversationDto } from "@alliance/shared/client";

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

export enum ConversationType {
  Direct = "direct",
  Multiple = "multiple",
  Community = "community",
}

export const conversationTypesWithEditableInfo: Record<
  ConversationType,
  boolean
> = {
  [ConversationType.Direct]: false,
  [ConversationType.Multiple]: true,
  [ConversationType.Community]: false,
};

export const conversationTypesWithEditableMembers: Record<
  ConversationType,
  boolean
> = {
  [ConversationType.Direct]: false,
  [ConversationType.Multiple]: true,
  [ConversationType.Community]: false,
};

export const conversationTypesUsersCanLeave: Record<ConversationType, boolean> =
  {
    [ConversationType.Direct]: false,
    [ConversationType.Multiple]: true,
    [ConversationType.Community]: false,
  };

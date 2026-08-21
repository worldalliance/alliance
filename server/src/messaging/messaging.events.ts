export const MessagingEvents = {
  MessageCreated: "messaging.message.created",
  ConversationUpdated: "messaging.conversation.updated",
} as const;

export type MessagingEventName =
  (typeof MessagingEvents)[keyof typeof MessagingEvents];

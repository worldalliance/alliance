import type { EventEmitter2 } from "@nestjs/event-emitter";

export const MessagingEvents = {
  MessageCreated: "messaging.message.created",
  ConversationUpdated: "messaging.conversation.updated",
} as const;

export type MessagingEventName =
  (typeof MessagingEvents)[keyof typeof MessagingEvents];

export interface ConversationUpdatedPayload {
  conversationId: number;
}

export function emitConversationUpdated(
  eventEmitter: EventEmitter2,
  conversationId: number,
): void {
  eventEmitter.emit(MessagingEvents.ConversationUpdated, {
    conversationId,
  } satisfies ConversationUpdatedPayload);
}

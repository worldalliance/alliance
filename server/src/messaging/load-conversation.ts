import type { Relations } from "src/utils/Repository";
import type { Repository } from "typeorm";
import {
  Conversation,
  loadedConversationParticipants,
} from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { loadHiddenReadCursors } from "./read-cursor";

export const conversationRelations = {
  participants: {
    user: true,
    lastReadMessage: { author: true },
  },
  community: true,
} as const satisfies Relations<Conversation>;

export async function loadConversation(
  conversationRepository: Repository<Conversation>,
  id: number,
): Promise<Conversation> {
  const conversation = await conversationRepository.findOneOrFail({
    where: { id },
    relations: conversationRelations,
  });
  await loadHiddenReadCursors(
    conversationRepository.manager.getRepository(Message),
    loadedConversationParticipants(conversation),
  );
  return conversation;
}

export function findLastMessage(
  messageRepository: Repository<Message>,
  conversationId: number,
): Promise<Message | null> {
  return messageRepository
    .createQueryBuilder("message")
    .leftJoinAndSelect("message.author", "author")
    .leftJoinAndSelect("message.replyTo", "replyTo")
    .leftJoinAndSelect("replyTo.author", "replyToAuthor")
    .where("message.conversationId = :conversationId", { conversationId })
    .orderBy("message.createdAt", "DESC")
    .limit(1)
    .getOne();
}

import { In, type Repository } from "typeorm";
import { Message } from "./entities/message.entity";
import type { Participant } from "./entities/participant.entity";

/** Whether `message` is past `participant`'s last-read message, even once
 * that message is hidden, or else past when they joined. */
export const UNREAD_SQL = `message.createdAt > COALESCE(
  (SELECT last_read."createdAt" FROM message last_read
   WHERE last_read.id = participant."lastReadMessageId"),
  participant."joinedAt"
) AND message.id IS DISTINCT FROM participant."lastReadMessageId"`;

/** A read cursor stays on its message once that message is hidden, so
 * unread state keeps starting after it. */
export async function loadHiddenReadCursors(
  messageRepository: Repository<Message>,
  participants: Participant[],
): Promise<void> {
  const ids = participants.flatMap((participant) =>
    participant.lastReadMessageId !== null && !participant.lastReadMessage
      ? [participant.lastReadMessageId]
      : [],
  );
  if (!ids.length) return;
  const messages = await messageRepository.find({
    where: { id: In(ids) },
    withDeleted: true,
  });
  const byId = new Map(messages.map((message) => [message.id, message]));
  for (const participant of participants) {
    if (participant.lastReadMessageId !== null) {
      participant.lastReadMessage ??= byId.get(participant.lastReadMessageId);
    }
  }
}

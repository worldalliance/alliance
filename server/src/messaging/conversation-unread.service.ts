import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { UnreadMessageSummary } from "./dto/messaging.dto";
import { Message } from "./entities/message.entity";
import { Participant, ParticipantState } from "./entities/participant.entity";
import { loadHiddenReadCursors, UNREAD_SQL } from "./read-cursor";

@Injectable()
export class ConversationUnreadService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async loadUnreadCounts(
    conversationIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!conversationIds.length) {
      return map;
    }

    await Promise.all(
      conversationIds.map(async (conversationId) => {
        const count = await this.countUnreadForConversation(
          conversationId,
          userId,
        );
        map.set(conversationId, count);
      }),
    );

    return map;
  }

  async countUnreadForConversation(
    conversationId: number,
    userId: number,
  ): Promise<number> {
    const participant = await this.participantRepository.findOneOrFail({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
      relations: { lastReadMessage: true },
    });
    await loadHiddenReadCursors(this.messageRepository, [participant]);

    const since =
      participant.lastReadMessage?.createdAt ??
      participant.joinedAt ??
      new Date(0);

    const qb = this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.authorId != :userId", { userId })
      .andWhere("message.createdAt > :since", { since });

    if (participant.lastReadMessage?.id) {
      qb.andWhere("message.id != :lastReadMessageId", {
        lastReadMessageId: participant.lastReadMessage.id,
      });
    }

    return qb.getCount();
  }

  async getUnreadMessages(userId: number): Promise<number> {
    const result = await this.participantRepository
      .createQueryBuilder("participant")
      .where("participant.userId = :userId", { userId })
      .andWhere((qb) => {
        const unreadSubQuery = qb
          .subQuery()
          .select("1")
          .from(Message, "message")
          .where("message.conversationId = participant.conversationId")
          .andWhere("message.authorId != :userId", { userId })
          .andWhere(UNREAD_SQL)
          .limit(1)
          .getQuery();

        return `EXISTS ${unreadSubQuery}`;
      })
      .select("COUNT(DISTINCT participant.conversationId)", "unreadCount")
      .getRawOne<{ unreadCount?: string }>();

    return Number(result?.unreadCount ?? 0);
  }

  async getUnreadSummary(userId: number): Promise<UnreadMessageSummary> {
    const [messageCount, messageRequestCount] = await Promise.all([
      this.sumUnreadCountsByParticipantState(userId, ParticipantState.Joined),
      this.countConversationsByParticipantState(
        userId,
        ParticipantState.Invited,
      ),
    ]);

    return {
      messageCount,
      messageRequestCount,
      totalCount: messageCount + messageRequestCount,
    };
  }

  private async sumUnreadCountsByParticipantState(
    userId: number,
    state: ParticipantState,
    options?: { minimumPerConversation?: number },
  ): Promise<number> {
    const minimumPerConversation = options?.minimumPerConversation ?? 0;
    const unreadCountSubquery = this.messageRepository
      .createQueryBuilder("message")
      .select("COUNT(message.id)")
      .where("message.conversationId = participant.conversationId")
      .andWhere("message.authorId != :userId", { userId })
      .andWhere(UNREAD_SQL)
      .getQuery();
    const unreadCountExpression =
      minimumPerConversation > 0
        ? `GREATEST((${unreadCountSubquery}), ${minimumPerConversation})`
        : `(${unreadCountSubquery})`;
    const result = await this.participantRepository
      .createQueryBuilder("participant")
      .select(`COALESCE(SUM(${unreadCountExpression}), 0)`, "total")
      .where("participant.userId = :userId", { userId })
      .andWhere("participant.state = :state", { state })
      .getRawOne<{ total?: string }>();

    return Number(result?.total ?? 0);
  }

  private async countConversationsByParticipantState(
    userId: number,
    state: ParticipantState,
  ): Promise<number> {
    const result = await this.participantRepository
      .createQueryBuilder("participant")
      .select("COUNT(DISTINCT participant.conversationId)", "total")
      .where("participant.userId = :userId", { userId })
      .andWhere("participant.state = :state", { state })
      .getRawOne<{ total?: string }>();

    return Number(result?.total ?? 0);
  }
}

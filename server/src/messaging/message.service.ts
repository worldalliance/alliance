import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { assertLive } from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { User } from "src/user/entities/user.entity";
import { IsNull, type Repository } from "typeorm";
import { ConversationService } from "./conversation.service";
import {
  ConversationMessagesQueryDto,
  CreateMessageDto,
  MessageDto,
} from "./dto/messaging.dto";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { Participant, ParticipantState } from "./entities/participant.entity";
import { MessagingEvents } from "./messaging.events";
import { notInConversation } from "./not-in-conversation";

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly eventEmitter: EventEmitter2,
    private readonly imagesService: ImagesService,
    private readonly conversationService: ConversationService,
  ) {}

  async sendMessage(
    userId: number,
    dto: CreateMessageDto,
  ): Promise<MessageDto> {
    const participant = await this.conversationService.getParticipantOrFail({
      conversationId: dto.conversationId,
      userId,
      relations: { conversation: true },
    });

    if (participant.state !== ParticipantState.Joined) {
      participant.state = ParticipantState.Joined;
      participant.joinedAt = new Date();
    }

    let replyTo: Message | undefined;
    if (dto.replyToId) {
      replyTo =
        (await this.messageRepository.findOne({
          where: { id: dto.replyToId },
          relations: { conversation: true },
        })) ?? undefined;

      if (!replyTo || replyTo.conversation.id !== participant.conversation.id) {
        throw new BadRequestException("Invalid reply target.");
      }
    }

    const trimmedBody = dto.body?.trim?.() ?? "";
    const attachments = await this.saveAttachments(dto.attachments);

    if (!trimmedBody.length && attachments.length === 0) {
      throw new BadRequestException(
        "Message must include text or at least one attachment.",
      );
    }

    const message = this.messageRepository.create({
      body: trimmedBody,
      attachments,
      author: { id: userId } as User,
      conversation: participant.conversation,
      replyTo,
    });

    // Holds what the message joins, so a removal committing meanwhile either
    // waits for the message or makes this throw.
    const savedMessage = await this.messageRepository.manager.transaction(
      async (manager) => {
        // In the order deletions lock in: an account before its messages,
        // a conversation before its messages, and a message before the read
        // cursors on it.
        await assertLive(manager, {
          rows: [
            { target: User, id: userId },
            { target: Conversation, id: participant.conversation.id },
          ],
          gone: notInConversation,
        });
        if (replyTo) {
          await assertLive(manager, {
            rows: [{ target: Message, id: replyTo.id }],
            gone: () => new BadRequestException("Invalid reply target."),
          });
        }
        await assertLive(manager, {
          rows: [{ target: Participant, id: participant.id }],
          gone: notInConversation,
        });

        const saved = await manager.save(message);
        await manager.update(
          Participant,
          { id: participant.id, deletedAt: IsNull() },
          {
            lastReadMessage: { id: saved.id },
            state: participant.state,
            joinedAt: participant.joinedAt,
          },
        );
        await manager.update(Conversation, participant.conversation.id, {
          updatedAt: new Date(),
        });
        return saved;
      },
    );

    const hydratedMessage = await this.messageRepository.findOneOrFail({
      where: { id: savedMessage.id },
      relations: {
        author: true,
        replyTo: { author: true },
        conversation: true,
      },
    });

    const dtoMessage = new MessageDto({
      message: hydratedMessage,
      conversationId:
        hydratedMessage.conversation?.id ?? participant.conversation.id,
    });

    this.eventEmitter.emit(MessagingEvents.MessageCreated, {
      conversationId: dto.conversationId,
      message: dtoMessage,
    });

    return dtoMessage;
  }

  async getConversationMessages(
    userId: number,
    conversationId: number,
    query: ConversationMessagesQueryDto,
  ): Promise<MessageDto[]> {
    await this.conversationService.getParticipantOrFail({
      conversationId,
      userId,
      relations: {},
    });
    return this.findConversationMessages(conversationId, query);
  }

  async getConversationMessagesForAdmin(
    conversationId: number,
    query: ConversationMessagesQueryDto,
  ): Promise<MessageDto[]> {
    return this.findConversationMessages(conversationId, query);
  }

  private async findConversationMessages(
    conversationId: number,
    query: ConversationMessagesQueryDto,
  ): Promise<MessageDto[]> {
    const limit = Math.min(query.limit ?? 50, 100);
    const qb = this.messageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.author", "author")
      .leftJoinAndSelect("message.replyTo", "replyTo")
      .leftJoinAndSelect("replyTo.author", "replyToAuthor")
      .where("message.conversationId = :conversationId", { conversationId })
      .orderBy("message.createdAt", "DESC")
      .take(limit);

    if (query.before) {
      qb.andWhere("message.createdAt < :before", {
        before: new Date(query.before),
      });
    }

    const messages = await qb.getMany();
    return messages
      .reverse()
      .map((message) => new MessageDto({ message, conversationId }));
  }

  private async saveAttachments(
    attachments: string[] | undefined,
  ): Promise<string[]> {
    if (!attachments?.length) {
      return [];
    }

    if (attachments.length > 30) {
      throw new BadRequestException("Too many attachments (max 30).");
    }

    const storedKeys: string[] = [];
    for (const attachment of attachments) {
      if (!attachment) {
        continue;
      }
      const trimmed = attachment.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith("data:image")) {
        const key = await this.imagesService.uploadImage(trimmed, {
          width: 1024,
          height: 1024,
        });
        storedKeys.push(key);
        continue;
      } else if (trimmed.length < 200) {
        storedKeys.push(trimmed);
      } else {
        console.warn("unknown attachment ", trimmed);
      }
    }

    return storedKeys;
  }
}

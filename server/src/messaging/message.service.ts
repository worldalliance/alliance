import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { ImagesService } from "src/images/images.service";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import {
  ConversationMessagesQueryDto,
  CreateMessageDto,
  MessageDto,
} from "./dto/messaging.dto";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { Participant, ParticipantState } from "./entities/participant.entity";
import { MessagingEvents } from "./messaging.events";

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    private readonly eventEmitter: EventEmitter2,
    private readonly imagesService: ImagesService,
  ) {}

  async sendMessage(
    userId: number,
    dto: CreateMessageDto,
  ): Promise<MessageDto> {
    const participant = await this.participantRepository.findOne({
      where: {
        conversation: { id: dto.conversationId },
        user: { id: userId },
      },
      relations: { conversation: true },
    });

    if (!participant) {
      throw new ForbiddenException("You are not part of this conversation.");
    }

    if (participant.state !== ParticipantState.Joined) {
      participant.state = ParticipantState.Joined;
      participant.joinedAt = new Date();
      await this.participantRepository.save(participant);
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

    const savedMessage = await this.messageRepository.save(message);
    participant.lastReadMessage = savedMessage;
    await this.participantRepository.save(participant);
    await this.conversationRepository.update(participant.conversation.id, {
      updatedAt: new Date(),
    });

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
    await this.assertParticipant(conversationId, userId);

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

  async getConversationMessagesForAdmin(
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

  private async assertParticipant(
    conversationId: number,
    userId: number,
  ): Promise<void> {
    const count = await this.participantRepository.count({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
    });

    if (!count) {
      throw new ForbiddenException("You are not part of this conversation.");
    }
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

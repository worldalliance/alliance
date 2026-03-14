import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './entities/participant.entity';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { PushService, CreatePushMessage } from 'src/push/push.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingEvents } from './messaging.events';
import { MessageDto } from './dto/messaging.dto';
import { conversationUrl } from 'src/search/approutes';

@Injectable()
export class MessagePushListener {
  private readonly logger = new Logger(MessagePushListener.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly pushService: PushService,
    private readonly messagingGateway: MessagingGateway,
  ) {
    this.eventEmitter.on(
      MessagingEvents.MessageCreated,
      this.handleMessageCreated.bind(this),
    );
  }

  private async handleMessageCreated(payload: {
    conversationId: number;
    message: MessageDto;
  }) {
    try {
      const { conversationId, message } = payload;

      const participants = await this.participantRepository.find({
        where: { conversation: { id: conversationId } },
        relations: { user: true },
      });

      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId },
      });

      if (!conversation) {
        this.logger.warn(`Conversation ${conversationId} not found for push`);
        return;
      }

      const activeViewers =
        this.messagingGateway.getUsersViewingConversation(conversationId);

      const eligibleParticipants = participants.filter((p) => {
        const user = p.user;
        if (user.id === message.author.id) return false;
        if (user.pushNotifsEnabled === false) return false;
        if (user.pushesForMessages === false) return false;
        if (user.turnedOffAllNotifs === true) return false;
        if (activeViewers.has(user.id)) return false;
        return true;
      });

      if (!eligibleParticipants.length) return;

      const body = this.buildPushBody(message, conversation);
      const screen = conversationUrl(conversationId);

      const allMessages: CreatePushMessage[] = [];

      for (const participant of eligibleParticipants) {
        const messages = await this.pushService.getPushForAllUserDevices(
          participant.user.id,
          {
            userId: participant.user.id,
            body,
            screen,
            idempotencyKey: `msg-${message.id}-${participant.user.id}`,
          },
        );
        allMessages.push(...messages);
      }

      if (allMessages.length) {
        await this.pushService.sendMessages(allMessages);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send message push notifications: ${error.message}`,
        error.stack,
      );
    }
  }

  private buildPushBody(
    message: MessageDto,
    conversation: Conversation,
  ): string {
    const senderName = message.author.displayName;
    const hasAttachments =
      message.attachments && message.attachments.length > 0;
    const messagePreview = message.body?.trim()
      ? message.body.trim()
      : hasAttachments
        ? 'Sent an image'
        : '';

    if (conversation.type === ConversationType.Direct) {
      return this.truncate(`${senderName}: ${messagePreview}`, 100);
    }

    return this.truncate(
      `${senderName} in ${conversation.title}: ${messagePreview}`,
      100,
    );
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
  }
}

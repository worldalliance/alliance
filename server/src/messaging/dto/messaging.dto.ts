import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CommunityDto } from 'src/user/community.dto';
import { ProfileDto } from 'src/user/user.dto';
import {
  Conversation,
  ConversationType,
} from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Participant, ParticipantState } from '../entities/participant.entity';
import { getImageSource } from 'src/images/images.service';

export class MessageReferenceDto extends PickType(Message, [
  'id',
  'body',
  'createdAt',
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  author: ProfileDto;

  constructor(message: Message) {
    super();
    Object.assign(this, message);
    this.author = new ProfileDto(message.author);
  }
}

export class MessageDto extends OmitType(Message, [
  'conversation',
  'author',
  'replyTo',
  'replies',
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  author: ProfileDto;

  @ApiProperty({ type: Number })
  conversationId: number;

  @ApiPropertyOptional({ type: () => MessageReferenceDto })
  @Type(() => MessageReferenceDto)
  replyTo?: MessageReferenceDto;

  constructor(message: Message, conversationId?: number) {
    super();
    Object.assign(this, message);
    this.author = new ProfileDto(message.author);
    this.conversationId =
      conversationId ?? message.conversation?.id ?? this.conversationId;
    this.attachments = (message.attachments ?? []).map((attachment) =>
      getImageSource(attachment),
    );
    this.replyTo = message.replyTo
      ? new MessageReferenceDto(message.replyTo)
      : undefined;
  }
}

export class ParticipantDto extends OmitType(Participant, [
  'conversation',
  'user',
  'lastReadMessage',
]) {
  @ApiProperty({ type: () => ProfileDto })
  @Type(() => ProfileDto)
  user: ProfileDto;

  @ApiPropertyOptional({ type: () => MessageReferenceDto })
  @Type(() => MessageReferenceDto)
  lastReadMessage?: MessageReferenceDto;

  constructor(participant: Participant) {
    super();
    Object.assign(this, participant);
    this.user = new ProfileDto(participant.user);
    this.lastReadMessage = participant.lastReadMessage
      ? new MessageReferenceDto(participant.lastReadMessage)
      : undefined;
  }
}

export class ConversationDto extends OmitType(Conversation, [
  'messages',
  'participants',
  'community',
]) {
  @ApiProperty({ type: () => ParticipantDto, isArray: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];

  @ApiPropertyOptional({ type: () => MessageDto })
  @Type(() => MessageDto)
  lastMessage?: MessageDto;

  @ApiPropertyOptional({ type: () => CommunityDto })
  @Type(() => CommunityDto)
  community?: CommunityDto;

  @ApiProperty({ type: Boolean })
  hasUnread: boolean;

  @ApiProperty({ type: Boolean })
  isMessageRequest: boolean;

  @ApiProperty({ type: Number })
  unreadCount: number;

  constructor(
    conversation: Conversation,
    extras?: {
      lastMessage?: Message | null;
      contextUserId?: number;
      unreadCount?: number;
    },
  ) {
    super();
    Object.assign(this, conversation);
    this.participants = (conversation.participants ?? []).map(
      (participant) => new ParticipantDto(participant),
    );
    this.community = conversation.community
      ? new CommunityDto(conversation.community)
      : undefined;
    this.lastMessage = extras?.lastMessage
      ? new MessageDto(extras.lastMessage, conversation.id)
      : undefined;
    this.unreadCount = extras?.unreadCount ?? 0;

    if (conversation.type === ConversationType.Direct) {
      const directTitle = this.resolveDirectTitle(extras?.contextUserId);
      if (directTitle) {
        this.title = directTitle;
      }
    }
    this.photo = conversation.photo
      ? getImageSource(conversation.photo)
      : conversation.type === ConversationType.Direct
        ? this.resolveDirectPhoto(extras?.contextUserId)
        : undefined;

    if (extras?.contextUserId) {
      const currentParticipant = conversation.participants?.find(
        (participant) => participant.user.id === extras.contextUserId,
      );
      this.isMessageRequest =
        currentParticipant?.state === ParticipantState.Invited;
      this.hasUnread =
        this.unreadCount > 0 ||
        (this.lastMessage
          ? this.isUnreadFromTimestamps(
              currentParticipant
                ? new ParticipantDto(currentParticipant)
                : undefined,
            )
          : false);
    } else {
      this.isMessageRequest = false;
      this.hasUnread = this.unreadCount > 0;
    }
  }

  private resolveDirectTitle(contextUserId?: number): string | undefined {
    const participant = this.findOtherParticipant(contextUserId);
    return participant?.user.displayName;
  }

  private resolveDirectPhoto(contextUserId?: number): string | undefined {
    return this.findOtherParticipant(contextUserId)?.user.profilePicture;
  }

  private findOtherParticipant(
    contextUserId?: number,
  ): ParticipantDto | undefined {
    if (!this.participants.length) {
      return undefined;
    }

    if (!contextUserId) {
      return this.participants[0];
    }

    return this.participants.find(
      (participant) => participant.user.id !== contextUserId,
    );
  }

  private isUnreadFromTimestamps(currentParticipant?: ParticipantDto): boolean {
    if (!this.lastMessage) {
      return false;
    }
    if (!currentParticipant) {
      return false;
    }

    const lastRead =
      currentParticipant.lastReadMessage?.createdAt ??
      currentParticipant.joinedAt;

    return lastRead ? this.lastMessage.createdAt > lastRead : true;
  }
}

export class CreateDirectConversationDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  targetUserId: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;
}

export class CreateGroupConversationDto {
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  photo?: string;

  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  participantIds: number[];
}

export class CreateMessageDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  conversationId: number;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(10000)
  body: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Image attachments encoded as data URLs or existing keys',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  photo?: string;
}

export class ConversationMessagesQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsISO8601()
  before?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ConversationParticipantDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  userId: number;
}

export class UnreadMessagesDto {
  @ApiProperty({ type: Number })
  @IsInt()
  count: number;
}

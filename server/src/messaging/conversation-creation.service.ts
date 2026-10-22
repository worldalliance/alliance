import { ConversationType } from "@alliance/common/conversationType";
import { ParticipantRole } from "@alliance/common/participantRole";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { ImagesService } from "src/images/images.service";
import { Friend } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import { acceptedFriendship, friendshipBetween } from "src/user/friendship";
import { In, type Repository } from "typeorm";
import { createConversationWithMembers } from "./create-conversation-with-members";
import {
  ConversationDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
} from "./dto/messaging.dto";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { ParticipantState } from "./entities/participant.entity";
import { findLastMessage, loadConversation } from "./load-conversation";
import { emitConversationUpdated } from "./messaging.events";

const PARTICIPANTS_MISSING = "One or more participants were not found.";

@Injectable()
export class ConversationCreationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly eventEmitter: EventEmitter2,
    private readonly imagesService: ImagesService,
  ) {}

  /** Whether two users have an accepted friendship in either direction. */
  private async queryAreUsersFriends(
    userIdA: number,
    userIdB: number,
  ): Promise<boolean> {
    return this.friendRepository.exists({
      where: { ...friendshipBetween(userIdA, userIdB), ...acceptedFriendship },
    });
  }

  async createDirectConversation(
    userId: number,
    dto: CreateDirectConversationDto,
  ): Promise<ConversationDto> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException("You cannot message yourself.");
    }

    const [initiator, target] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: dto.targetUserId } }),
    ]);

    if (!initiator) {
      throw new NotFoundException("User not found.");
    }

    if (!target) {
      throw new NotFoundException("Recipient not found.");
    }

    const existingConversation = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin(
        "conversation.participants",
        "initiatorParticipant",
        "initiatorParticipant.userId = :userId",
        { userId },
      )
      .innerJoin(
        "conversation.participants",
        "targetParticipant",
        "targetParticipant.userId = :targetUserId",
        { targetUserId: dto.targetUserId },
      )
      .where("conversation.type = :type", {
        type: ConversationType.Direct,
      })
      .getOne();

    if (existingConversation) {
      const hydrated = await loadConversation(
        this.conversationRepository,
        existingConversation.id,
      );
      const lastMessage = await findLastMessage(
        this.messageRepository,
        existingConversation.id,
      );
      return new ConversationDto({
        conversation: hydrated,
        contextUserId: userId,
        lastMessage,
      });
    }

    const areFriends = await this.queryAreUsersFriends(
      userId,
      dto.targetUserId,
    );

    // Messaging an admin (or an admin messaging a user) skips the request
    const involvesAdmin = initiator.admin || target.admin;
    const autoJoin = areFriends || involvesAdmin;

    const conversation = await createConversationWithMembers(
      this.conversationRepository.manager,
      {
        conversation: {
          title: dto.title?.trim() || "Direct message",
          type: ConversationType.Direct,
        },
        members: [
          {
            user: initiator,
            role: ParticipantRole.Member,
            state: ParticipantState.Joined,
          },
          {
            user: target,
            role: ParticipantRole.Member,
            state: autoJoin
              ? ParticipantState.Joined
              : ParticipantState.Invited,
          },
        ],
        gone: (missing) =>
          new NotFoundException(
            missing.has(target.id) ? "Recipient not found." : "User not found.",
          ),
      },
    );

    const hydratedConversation = await loadConversation(
      this.conversationRepository,
      conversation.id,
    );
    emitConversationUpdated(this.eventEmitter, hydratedConversation.id);
    return new ConversationDto({
      conversation: hydratedConversation,
      contextUserId: userId,
    });
  }

  async createOrGetGroupConversation(
    userId: number,
    dto: CreateGroupConversationDto,
  ): Promise<ConversationDto> {
    const uniqueParticipantIds = Array.from(
      new Set(dto.participantIds.filter((id) => id !== userId)),
    );

    if (!uniqueParticipantIds.length) {
      throw new BadRequestException(
        "A group conversation requires at least one additional participant.",
      );
    }

    const allUserIds = [userId, ...uniqueParticipantIds];

    const existingConversation = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin("conversation.participants", "p")
      .where("conversation.type = :type", {
        type: ConversationType.Multiple,
      })
      .groupBy("conversation.id")
      // Total number of participants must match exactly
      .having("COUNT(DISTINCT p.userId) = :participantCount", {
        participantCount: allUserIds.length,
      })
      // All participants must be within the requested set
      .andHaving(
        "COUNT(DISTINCT CASE WHEN p.userId IN (:...allUserIds) THEN p.userId END) = :participantCount",
        {
          allUserIds,
          participantCount: allUserIds.length,
        },
      )
      .getOne();

    if (existingConversation) {
      const hydrated = await loadConversation(
        this.conversationRepository,
        existingConversation.id,
      );
      const lastMessage = await findLastMessage(
        this.messageRepository,
        existingConversation.id,
      );
      return new ConversationDto({
        conversation: hydrated,
        contextUserId: userId,
        lastMessage,
      });
    }

    const [owner, participants] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.find({
        where: { id: In(uniqueParticipantIds) },
      }),
    ]);

    if (!owner) {
      throw new NotFoundException("User not found.");
    }

    if (participants.length !== uniqueParticipantIds.length) {
      throw new NotFoundException(PARTICIPANTS_MISSING);
    }

    const photo = await this.imagesService.resolvePhotoUpdate(dto.photo);

    const conversation = await createConversationWithMembers(
      this.conversationRepository.manager,
      {
        conversation: {
          title: dto.title,
          photo: photo ?? null,
          type: ConversationType.Multiple,
        },
        members: [
          {
            user: owner,
            role: ParticipantRole.Owner,
            state: ParticipantState.Joined,
          },
          ...participants.map((user) => ({
            user,
            role: ParticipantRole.Member,
            state: ParticipantState.Invited,
          })),
        ],
        gone: () => new NotFoundException(PARTICIPANTS_MISSING),
      },
    );

    const hydratedConversation = await loadConversation(
      this.conversationRepository,
      conversation.id,
    );
    emitConversationUpdated(this.eventEmitter, hydratedConversation.id);
    return new ConversationDto({
      conversation: hydratedConversation,
      contextUserId: userId,
    });
  }
}

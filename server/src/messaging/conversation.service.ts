import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { ImagesService } from "src/images/images.service";
import { Friend, FriendStatus } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import { UserEvents, type FriendsAcceptedPayload } from "src/user/user.events";
import type { Relations } from "src/utils/Repository";
import { In, type EntityManager, type Repository } from "typeorm";
import {
  ConversationAdminSummaryDto,
  ConversationDto,
  ConversationParticipantDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  UnreadMessageSummary,
  UpdateConversationDto,
} from "./dto/messaging.dto";
import { Conversation, ConversationType } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import {
  Participant,
  ParticipantRole,
  ParticipantState,
} from "./entities/participant.entity";
import { MessagingEvents } from "./messaging.events";

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  private readonly conversationRelations = {
    participants: {
      user: true,
      lastReadMessage: { author: true },
    },
    community: true,
  } as const satisfies Relations<Conversation>;

  private readonly participantRelations = {
    conversation: {
      participants: { user: true, lastReadMessage: { author: true } },
    },
    user: true,
    lastReadMessage: { author: true },
  } as const satisfies Relations<Participant>;

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly eventEmitter: EventEmitter2,
    private readonly imagesService: ImagesService,
  ) {
    this.eventEmitter.on(
      UserEvents.FriendsAccepted,
      this.handleFriendsAccepted.bind(this),
    );
  }

  /** Log and swallow errors so a failure here can't affect the friendship. */
  private async handleFriendsAccepted(
    payload: FriendsAcceptedPayload,
  ): Promise<void> {
    try {
      await this.acceptDirectInviteBetween(payload.userIdA, payload.userIdB);
    } catch (error) {
      this.logger.error(
        "Error auto-accepting direct invite for new friends:",
        error,
      );
    }
  }

  /** Whether two users have an accepted friendship in either direction. */
  private async queryAreUsersFriends(
    userIdA: number,
    userIdB: number,
  ): Promise<boolean> {
    const friendship = await this.friendRepository.findOne({
      where: [
        {
          requester: { id: userIdA },
          addressee: { id: userIdB },
          status: FriendStatus.Accepted,
        },
        {
          requester: { id: userIdB },
          addressee: { id: userIdA },
          status: FriendStatus.Accepted,
        },
      ],
    });
    return friendship !== null;
  }

  async getAllConversationsForAdmin(): Promise<ConversationAdminSummaryDto[]> {
    const conversations = await this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participant")
      .leftJoinAndSelect("participant.user", "participantUser")
      .leftJoinAndSelect("participant.lastReadMessage", "participantLastRead")
      .leftJoinAndSelect(
        "participantLastRead.author",
        "participantLastReadAuthor",
      )
      .leftJoinAndSelect("conversation.community", "community")
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();

    if (!conversations.length) {
      return [];
    }

    const conversationIds = conversations.map(
      (conversation) => conversation.id,
    );
    const lastMessages = await this.loadLastMessages(conversationIds);
    const messageCounts = await this.loadMessageCounts(conversationIds);

    return conversations.map(
      (conversation) =>
        new ConversationAdminSummaryDto({
          conversation,
          lastMessage: lastMessages.get(conversation.id),
          messageCount: messageCounts.get(conversation.id) ?? 0,
        }),
    );
  }

  async getUserConversations(userId: number): Promise<ConversationDto[]> {
    await this.ensureCommunityMembershipForUser(userId);

    const conversations = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin(
        "conversation.participants",
        "membership",
        "membership.userId = :userId",
        { userId },
      )
      .leftJoinAndSelect("conversation.participants", "participant")
      .leftJoinAndSelect("participant.user", "participantUser")
      .leftJoinAndSelect("participant.lastReadMessage", "participantLastRead")
      .leftJoinAndSelect(
        "participantLastRead.author",
        "participantLastReadAuthor",
      )
      .leftJoinAndSelect("conversation.community", "community")
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();

    if (!conversations.length) {
      return [];
    }

    const conversationIds = conversations.map(
      (conversation) => conversation.id,
    );
    const lastMessages = await this.loadLastMessages(conversationIds);
    const unreadCounts = await this.loadUnreadCounts(conversationIds, userId);

    return conversations.map(
      (conversation) =>
        new ConversationDto({
          conversation,
          contextUserId: userId,
          lastMessage: lastMessages.get(conversation.id),
          unreadCount: unreadCounts.get(conversation.id) ?? 0,
        }),
    );
  }

  async getConversationForUser(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    return this.buildConversationDto(conversationId, userId);
  }

  async getConversationForCommunity(
    communityId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const conversation = await this.conversationRepository.findOneOrFail({
      where: { community: { id: communityId } },
      relations: this.conversationRelations,
    });
    if (
      !conversation.participants.some(
        (participant) => participant.user.id === userId,
      )
    ) {
      throw new BadRequestException();
    }
    return this.buildConversationDto(conversation.id, userId);
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
      const hydrated = await this.getConversationEntity(
        existingConversation.id,
      );
      const lastMessage = await this.findLastMessage(existingConversation.id);
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

    const conversation = await this.conversationRepository.save(
      this.conversationRepository.create({
        title: dto.title?.trim() || "Direct message",
        type: ConversationType.Direct,
      }),
    );

    const now = new Date();
    await this.participantRepository.save([
      this.participantRepository.create({
        conversation,
        user: initiator,
        role: ParticipantRole.Member,
        state: ParticipantState.Joined,
        joinedAt: now,
      }),
      this.participantRepository.create({
        conversation,
        user: target,
        role: ParticipantRole.Member,
        state: autoJoin ? ParticipantState.Joined : ParticipantState.Invited,
        joinedAt: now,
      }),
    ]);

    const hydratedConversation = await this.getConversationEntity(
      conversation.id,
    );
    await this.emitConversationUpdate(hydratedConversation);
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
      const hydrated = await this.getConversationEntity(
        existingConversation.id,
      );
      const lastMessage = await this.findLastMessage(existingConversation.id);
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
      throw new NotFoundException("One or more participants were not found.");
    }

    const conversation = await this.conversationRepository.save(
      this.conversationRepository.create({
        title: dto.title.trim(),
        photo: dto.photo,
        type: ConversationType.Multiple,
      }),
    );

    const now = new Date();
    await this.participantRepository.save([
      this.participantRepository.create({
        conversation,
        user: owner,
        role: ParticipantRole.Owner,
        state: ParticipantState.Joined,
        joinedAt: now,
      }),
      ...participants.map((user) =>
        this.participantRepository.create({
          conversation,
          user,
          role: ParticipantRole.Member,
          state: ParticipantState.Invited,
          joinedAt: now,
        }),
      ),
    ]);

    const hydratedConversation = await this.getConversationEntity(
      conversation.id,
    );
    await this.emitConversationUpdate(hydratedConversation);
    return new ConversationDto({
      conversation: hydratedConversation,
      contextUserId: userId,
    });
  }

  async acceptInvite(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail(conversationId, userId);

    if (participant.state === ParticipantState.Joined) {
      return this.buildConversationDto(conversationId, userId);
    }

    participant.state = ParticipantState.Joined;
    participant.joinedAt = new Date();
    await this.participantRepository.save(participant);
    await this.touchConversation(conversationId);

    const conversation = await this.getConversationEntity(conversationId);
    await this.emitConversationUpdate(conversation);
    return this.buildConversationDto(conversationId, userId);
  }

  /**
   * Auto-accept any outstanding direct-message invite between two new friends
   * so a friend never appears as a pending message request. No-op when there's
   * no direct conversation or pending invite.
   */
  private async acceptDirectInviteBetween(
    userIdA: number,
    userIdB: number,
  ): Promise<void> {
    const conversation = await this.conversationRepository
      .createQueryBuilder("conversation")
      .innerJoin(
        "conversation.participants",
        "participantA",
        "participantA.userId = :userIdA",
        { userIdA },
      )
      .innerJoin(
        "conversation.participants",
        "participantB",
        "participantB.userId = :userIdB",
        { userIdB },
      )
      .where("conversation.type = :type", { type: ConversationType.Direct })
      .getOne();

    if (!conversation) {
      return;
    }

    const invitedParticipants = await this.participantRepository.find({
      where: {
        conversation: { id: conversation.id },
        user: { id: In([userIdA, userIdB]) },
        state: ParticipantState.Invited,
      },
    });

    if (invitedParticipants.length === 0) {
      return;
    }

    const now = new Date();
    for (const participant of invitedParticipants) {
      participant.state = ParticipantState.Joined;
      participant.joinedAt = now;
    }
    await this.participantRepository.save(invitedParticipants);
    await this.touchConversation(conversation.id);

    const hydrated = await this.getConversationEntity(conversation.id);
    await this.emitConversationUpdate(hydrated);
  }

  async declineInvite(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail(conversationId, userId);
    await this.participantRepository.remove(participant);
    await this.touchConversation(conversationId);
    const conversation = await this.getConversationEntity(conversationId);
    await this.emitConversationUpdate(conversation);
    if (conversation.type === ConversationType.Direct) {
      await this.conversationRepository.delete(conversationId);
      return new ConversationDto({ conversation, contextUserId: userId }); // return with info despite delete so decliner sees declined state
    }
    return new ConversationDto({ conversation, contextUserId: userId });
  }

  async updateConversation(
    conversationId: number,
    userId: number,
    dto: UpdateConversationDto,
  ): Promise<ConversationDto> {
    const conversation = await this.getConversationEntity(conversationId);

    if (conversation.type !== ConversationType.Direct) {
      conversation.title = dto.title ?? conversation.title;

      if (dto.photo?.startsWith("data:")) {
        conversation.photo =
          await this.imagesService.processAndUploadProfileImage(dto.photo);
      }
    }

    await this.conversationRepository.save(conversation);
    return new ConversationDto({ conversation, contextUserId: userId });
  }

  async addParticipantToConversation(
    conversationId: number,
    actingUserId: number,
    dto: ConversationParticipantDto,
  ): Promise<ConversationDto> {
    const adminParticipant = await this.ensureConversationAdmin(
      conversationId,
      actingUserId,
    );

    const alreadyParticipant = adminParticipant.conversation.participants?.some(
      (participant) => participant.user.id === dto.userId,
    );

    if (alreadyParticipant) {
      return this.buildConversationDto(conversationId, actingUserId);
    }

    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const participant = this.participantRepository.create({
      conversation: adminParticipant.conversation,
      user,
      role: ParticipantRole.Member,
      state: ParticipantState.Invited,
      joinedAt: new Date(),
    });

    await this.participantRepository.save(participant);
    await this.touchConversation(conversationId);
    const updatedConversation =
      await this.getConversationEntity(conversationId);
    await this.emitConversationUpdate(updatedConversation);
    return new ConversationDto({
      conversation: updatedConversation,
      contextUserId: actingUserId,
    });
  }

  async removeParticipantFromConversation(
    conversationId: number,
    actingUserId: number,
    targetUserId: number,
  ): Promise<ConversationDto> {
    const adminParticipant = await this.ensureConversationAdmin(
      conversationId,
      actingUserId,
    );

    const targetParticipant = await this.participantRepository.findOne({
      where: {
        conversation: { id: conversationId },
        user: { id: targetUserId },
      },
      relations: { user: true },
    });

    if (!targetParticipant) {
      throw new NotFoundException("Participant not found.");
    }

    if (
      targetParticipant.role === ParticipantRole.Owner &&
      adminParticipant.user.id !== targetParticipant.user.id
    ) {
      throw new ForbiddenException("Only owners can remove other owners.");
    }

    await this.participantRepository.remove(targetParticipant);
    await this.touchConversation(conversationId);
    const updatedConversation =
      await this.getConversationEntity(conversationId);
    await this.emitConversationUpdate(updatedConversation);
    return new ConversationDto({
      conversation: updatedConversation,
      contextUserId: actingUserId,
    });
  }

  async leaveConversation(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail(conversationId, userId);
    await this.participantRepository.remove(participant);
    const updatedConversation =
      await this.getConversationEntity(conversationId);
    await this.emitConversationUpdate(updatedConversation);
    return new ConversationDto({
      conversation: updatedConversation,
      contextUserId: userId,
    });
  }

  async syncCommunityConversationMembers(
    communityId: number,
  ): Promise<Conversation> {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      relations: { users: true, leaders: true },
    });

    if (!community) {
      throw new NotFoundException("Community not found.");
    }

    let conversation = await this.conversationRepository.findOne({
      where: { community: { id: community.id } },
      relations: this.conversationRelations,
    });

    if (!conversation) {
      conversation = await this.conversationRepository.save(
        this.conversationRepository.create({
          title: community.name,
          photo: community.photo,
          type: ConversationType.Community,
          community,
        }),
      );
    } else {
      const needsUpdate =
        conversation.title !== community.name ||
        conversation.photo !== community.photo;
      if (needsUpdate) {
        conversation.title = community.name;
        conversation.photo = community.photo;
        await this.conversationRepository.save(conversation);
      }
    }

    conversation = await this.getConversationEntity(conversation.id);

    const desiredUsers = new Map<number, User>();
    (community.users ?? []).forEach((user) => desiredUsers.set(user.id, user));
    (community.leaders ?? []).forEach((user) =>
      desiredUsers.set(user.id, user),
    );

    const leaderIds = new Set(
      (community.leaders ?? []).map((leader) => leader.id),
    );

    const participantMap = new Map<number, Participant>(
      (conversation.participants ?? []).map((participant) => [
        participant.user.id,
        participant,
      ]),
    );
    const now = new Date();

    for (const [userId, user] of desiredUsers) {
      const existing = participantMap.get(userId);
      const role = leaderIds.has(userId)
        ? ParticipantRole.Admin
        : ParticipantRole.Member;
      if (existing) {
        let shouldUpdate = false;
        if (existing.role !== role) {
          existing.role = role;
          shouldUpdate = true;
        }
        if (existing.state !== ParticipantState.Joined) {
          existing.state = ParticipantState.Joined;
          shouldUpdate = true;
        }
        if (shouldUpdate) {
          existing.joinedAt = existing.joinedAt ?? now;
          await this.participantRepository.save(existing);
        }
      } else {
        await this.participantRepository.save(
          this.participantRepository.create({
            conversation,
            user,
            role,
            state: ParticipantState.Joined,
            joinedAt: now,
          }),
        );
      }
    }

    const removable = (conversation.participants ?? []).filter(
      (participant) => !desiredUsers.has(participant.user.id),
    );
    if (removable.length) {
      await this.participantRepository.remove(removable);
    }

    const updatedConversation = await this.getConversationEntity(
      conversation.id,
    );
    await this.emitConversationUpdate(updatedConversation);
    return updatedConversation;
  }

  async placeCommunityConversationParticipant(params: {
    manager: EntityManager;
    user: User;
    sourceCommunity: Community | null;
    destinationCommunity: Community;
  }): Promise<void> {
    const { manager, user, sourceCommunity, destinationCommunity } = params;
    const conversationRepository = manager.getRepository(Conversation);
    const participantRepository = manager.getRepository(Participant);

    if (sourceCommunity) {
      const sourceConversation = await conversationRepository.findOne({
        where: { community: { id: sourceCommunity.id } },
      });
      if (sourceConversation) {
        await participantRepository.delete({
          conversation: { id: sourceConversation.id },
          user: { id: user.id },
        });
      }
    }

    let destinationConversation = await conversationRepository.findOne({
      where: { community: { id: destinationCommunity.id } },
    });
    if (!destinationConversation) {
      destinationConversation = await conversationRepository.save(
        conversationRepository.create({
          title: destinationCommunity.name,
          photo: destinationCommunity.photo,
          type: ConversationType.Community,
          community: destinationCommunity,
        }),
      );
    }

    const existingParticipant = await participantRepository.findOne({
      where: {
        conversation: { id: destinationConversation.id },
        user: { id: user.id },
      },
    });
    const role = destinationCommunity.leaders?.some(
      (leader) => leader.id === user.id,
    )
      ? ParticipantRole.Admin
      : ParticipantRole.Member;
    if (existingParticipant) {
      await participantRepository.save({
        ...existingParticipant,
        role,
        state: ParticipantState.Joined,
      });
      return;
    }

    await participantRepository.save(
      participantRepository.create({
        conversation: destinationConversation,
        user,
        role,
        state: ParticipantState.Joined,
        joinedAt: new Date(),
      }),
    );
  }

  async markConversationRead(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail(conversationId, userId);

    const lastMessage = await this.findLastMessage(conversationId);

    if (lastMessage) {
      participant.lastReadMessage = lastMessage;
      await this.participantRepository.save(participant);
    }

    const conversation = await this.getConversationEntity(conversationId);
    const unreadCount = await this.countUnreadForConversation(
      conversationId,
      userId,
    );
    await this.emitConversationUpdate(conversation);

    return new ConversationDto({
      conversation,
      contextUserId: userId,
      lastMessage,
      unreadCount,
    });
  }

  async isParticipant(
    conversationId: number,
    userId: number,
  ): Promise<boolean> {
    const count = await this.participantRepository.count({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
    });
    return count > 0;
  }

  private async ensureConversationAdmin(
    conversationId: number,
    userId: number,
  ): Promise<Participant> {
    const participant = await this.getParticipantOrFail(conversationId, userId);
    if (!this.isConversationAdmin(participant)) {
      throw new ForbiddenException("Admin access required.");
    }
    return participant;
  }

  private async ensureCommunityMembershipForUser(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { communities: true },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    await Promise.all(
      (user.communities ?? []).map((community) =>
        this.syncCommunityConversationMembers(community.id),
      ),
    );
  }

  private async getConversationEntity(id: number): Promise<Conversation> {
    return this.conversationRepository.findOneOrFail({
      where: { id },
      relations: this.conversationRelations,
    });
  }

  private async getParticipantOrFail(
    conversationId: number,
    userId: number,
  ): Promise<Participant> {
    const participant = await this.participantRepository.findOne({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
      relations: this.participantRelations,
    });

    if (!participant) {
      throw new ForbiddenException("You are not part of this conversation.");
    }

    return participant;
  }

  private async buildConversationDto(
    conversationId: number,
    contextUserId?: number,
  ): Promise<ConversationDto> {
    const conversation = await this.getConversationEntity(conversationId);
    const lastMessage = await this.findLastMessage(conversationId);
    const unreadCount = contextUserId
      ? await this.countUnreadForConversation(conversationId, contextUserId)
      : 0;
    return new ConversationDto({
      conversation,
      contextUserId,
      lastMessage,
      unreadCount,
    });
  }

  private async findLastMessage(
    conversationId: number,
  ): Promise<Message | null> {
    return this.messageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.author", "author")
      .leftJoinAndSelect("message.replyTo", "replyTo")
      .leftJoinAndSelect("replyTo.author", "replyToAuthor")
      .where("message.conversationId = :conversationId", { conversationId })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();
  }

  private async loadLastMessages(
    conversationIds: number[],
  ): Promise<Map<number, Message>> {
    const map = new Map<number, Message>();
    if (!conversationIds.length) {
      return map;
    }

    const messages = await this.messageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.author", "author")
      .leftJoinAndSelect("message.replyTo", "replyTo")
      .leftJoinAndSelect("replyTo.author", "replyToAuthor")
      .leftJoinAndSelect("message.conversation", "conversation")
      .where("conversation.id IN (:...conversationIds)", { conversationIds })
      .distinctOn(["conversation.id"])
      .orderBy("conversation.id", "ASC")
      .addOrderBy("message.createdAt", "DESC")
      .getMany();

    messages.forEach((message) => {
      const conversationId = message.conversation?.id;
      if (conversationId) {
        map.set(conversationId, message);
      }
    });

    return map;
  }

  private async loadMessageCounts(
    conversationIds: number[],
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!conversationIds.length) {
      return map;
    }

    const rows = await this.messageRepository
      .createQueryBuilder("message")
      .select("message.conversationId", "conversationId")
      .addSelect("COUNT(message.id)", "count")
      .where("message.conversationId IN (:...conversationIds)", {
        conversationIds,
      })
      .groupBy("message.conversationId")
      .getRawMany<{ conversationId: number; count: string }>();

    rows.forEach((row) => {
      map.set(Number(row.conversationId), Number(row.count));
    });

    return map;
  }

  private async loadUnreadCounts(
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

  private async emitConversationUpdate(conversation: Conversation) {
    this.eventEmitter.emit(MessagingEvents.ConversationUpdated, {
      conversationId: conversation.id,
    });
  }

  private async touchConversation(conversationId: number) {
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });
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

  private isConversationAdmin(participant: Participant): boolean {
    return [ParticipantRole.Admin, ParticipantRole.Owner].includes(
      participant.role,
    );
  }

  async getUnreadMessages(userId: number): Promise<number> {
    const result = await this.participantRepository
      .createQueryBuilder("participant")
      .leftJoin("participant.lastReadMessage", "lastReadMessage")
      .where("participant.userId = :userId", { userId })
      .andWhere((qb) => {
        const unreadSubQuery = qb
          .subQuery()
          .select("1")
          .from(Message, "message")
          .where("message.conversationId = participant.conversationId")
          .andWhere("message.authorId != :userId", { userId })
          .andWhere(
            "message.createdAt > COALESCE(lastReadMessage.createdAt, participant.joinedAt)",
          )
          .andWhere(
            "(message.id != lastReadMessage.id OR lastReadMessage.id IS NULL)",
          )
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
      .andWhere(
        "message.createdAt > COALESCE(lastReadMessage.createdAt, participant.joinedAt)",
      )
      .andWhere(
        "(message.id != lastReadMessage.id OR lastReadMessage.id IS NULL)",
      )
      .getQuery();
    const unreadCountExpression =
      minimumPerConversation > 0
        ? `GREATEST((${unreadCountSubquery}), ${minimumPerConversation})`
        : `(${unreadCountSubquery})`;
    const result = await this.participantRepository
      .createQueryBuilder("participant")
      .leftJoin("participant.lastReadMessage", "lastReadMessage")
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

/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  ConversationType,
  conversationTypesUsersCanLeave,
  conversationTypesWithEditableInfo,
  conversationTypesWithEditableMembers,
} from "@alliance/common/conversationType";
import {
  ParticipantRole,
  rolesWithAdminPowers,
} from "@alliance/common/participantRole";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import {
  assertLive,
  softDeleteCascade,
  softDeleteWhere,
  updateLive,
} from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { loadedUserCommunities, User } from "src/user/entities/user.entity";
import { UserEvents, type FriendsAcceptedPayload } from "src/user/user.events";
import type { Relations } from "src/utils/Repository";
import { isUniqueViolation } from "src/utils/db-errors";
import { In, IsNull, type Repository } from "typeorm";
import { CommunityConversationService } from "./community-conversation.service";
import { ConversationUnreadService } from "./conversation-unread.service";
import {
  ConversationAdminSummaryDto,
  ConversationDto,
  ConversationParticipantDto,
  UpdateConversationDto,
} from "./dto/messaging.dto";
import {
  Conversation,
  loadedConversationParticipants,
} from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import {
  loadedParticipantConversation,
  loadedParticipantUser,
  Participant,
  ParticipantState,
} from "./entities/participant.entity";
import { findLastMessage, loadConversation } from "./load-conversation";
import { emitConversationUpdated } from "./messaging.events";
import { notInConversation } from "./not-in-conversation";
import { loadHiddenReadCursors } from "./read-cursor";

type ParticipantLookup = {
  conversationId: number;
  userId: number;
  relations?: Relations<Participant>;
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

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
    private readonly eventEmitter: EventEmitter2,
    private readonly imagesService: ImagesService,
    private readonly unreadService: ConversationUnreadService,
    private readonly communityConversationService: CommunityConversationService,
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

  private conversationListQuery() {
    return this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participant")
      .leftJoinAndSelect("participant.user", "participantUser")
      .leftJoinAndSelect("participant.lastReadMessage", "participantLastRead")
      .leftJoinAndSelect(
        "participantLastRead.author",
        "participantLastReadAuthor",
      )
      .leftJoinAndSelect("conversation.community", "community")
      .orderBy("conversation.updatedAt", "DESC");
  }

  async getAllConversationsForAdmin(): Promise<ConversationAdminSummaryDto[]> {
    const conversations = await this.conversationListQuery().getMany();

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

    const conversations = await this.conversationListQuery()
      .innerJoin(
        "conversation.participants",
        "membership",
        "membership.userId = :userId",
        { userId },
      )
      .getMany();

    if (!conversations.length) {
      return [];
    }

    await loadHiddenReadCursors(
      this.messageRepository,
      conversations.flatMap((conversation) =>
        loadedConversationParticipants(conversation).filter(
          (participant) => loadedParticipantUser(participant).id === userId,
        ),
      ),
    );
    const conversationIds = conversations.map(
      (conversation) => conversation.id,
    );
    const lastMessages = await this.loadLastMessages(conversationIds);
    const unreadCounts = await this.unreadService.loadUnreadCounts(
      conversationIds,
      userId,
    );

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
    });
    await this.getParticipantOrFail({
      conversationId: conversation.id,
      userId,
      relations: {},
    });
    return this.buildConversationDto(conversation.id, userId);
  }

  async acceptInvite(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail({
      conversationId,
      userId,
    });

    if (participant.state === ParticipantState.Joined) {
      return this.buildConversationDto(conversationId, userId);
    }

    if (
      !(await updateLive(this.participantRepository.manager, {
        target: Participant,
        id: participant.id,
        changes: { state: ParticipantState.Joined, joinedAt: new Date() },
      }))
    ) {
      throw notInConversation();
    }
    await this.touchConversation(conversationId);

    const conversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    emitConversationUpdated(this.eventEmitter, conversation.id);
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

    await this.participantRepository.update(
      {
        id: In(invitedParticipants.map((participant) => participant.id)),
        deletedAt: IsNull(),
      },
      { state: ParticipantState.Joined, joinedAt: new Date() },
    );
    await this.touchConversation(conversation.id);

    const hydrated = await loadConversation(
      this.conversationRepository,
      conversation.id,
    );
    emitConversationUpdated(this.eventEmitter, hydrated.id);
  }

  async declineInvite(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail({
      conversationId,
      userId,
    });
    if (participant.state !== ParticipantState.Invited) {
      throw new ForbiddenException("There's no invite to decline.");
    }
    await this.softDeleteParticipants([participant]);
    await this.touchConversation(conversationId);
    const conversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    emitConversationUpdated(this.eventEmitter, conversation.id);
    if (conversation.type === ConversationType.Direct) {
      await softDeleteWhere(this.conversationRepository.manager, {
        target: Conversation,
        where: { id: conversationId },
      });
      return new ConversationDto({ conversation, contextUserId: userId }); // return with info despite delete so decliner sees declined state
    }
    return new ConversationDto({ conversation, contextUserId: userId });
  }

  async updateConversation(
    conversationId: number,
    userId: number,
    dto: UpdateConversationDto,
  ): Promise<ConversationDto> {
    await this.ensureConversationAdmin(conversationId, userId);
    const conversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );

    if (!conversationTypesWithEditableInfo[conversation.type]) {
      throw new ForbiddenException(
        "This conversation's name and photo cannot be changed.",
      );
    }

    conversation.title = dto.title ?? conversation.title;

    if (dto.photo?.startsWith("data:")) {
      conversation.photo =
        await this.imagesService.processAndUploadProfileImage(dto.photo);
    }

    await updateLive(this.conversationRepository.manager, {
      target: Conversation,
      id: conversationId,
      changes: { title: conversation.title, photo: conversation.photo },
      notFound: "Conversation not found",
    });
    emitConversationUpdated(this.eventEmitter, conversation.id);
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
    const conversation = loadedParticipantConversation(adminParticipant);

    this.ensureMembersEditable(conversation);

    const alreadyParticipant = loadedConversationParticipants(
      conversation,
    ).some(
      (participant) => loadedParticipantUser(participant).id === dto.userId,
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

    try {
      await this.participantRepository.manager.transaction(async (manager) => {
        await assertLive(manager, {
          rows: [{ target: Conversation, id: conversationId }],
          gone: () => new NotFoundException("Conversation not found."),
        });
        await assertLive(manager, {
          rows: [{ target: User, id: user.id }],
          gone: () => new NotFoundException("User not found."),
        });
        await manager.save(
          manager.create(Participant, {
            conversation,
            user,
            role: ParticipantRole.Member,
            state: ParticipantState.Invited,
            joinedAt: new Date(),
          }),
        );
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.buildConversationDto(conversationId, actingUserId);
    }
    await this.touchConversation(conversationId);
    const updatedConversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    emitConversationUpdated(this.eventEmitter, updatedConversation.id);
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

    this.ensureMembersEditable(loadedParticipantConversation(adminParticipant));

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
      loadedParticipantUser(adminParticipant).id !==
        loadedParticipantUser(targetParticipant).id
    ) {
      throw new ForbiddenException("Only owners can remove other owners.");
    }

    await this.softDeleteParticipants([targetParticipant]);
    await this.touchConversation(conversationId);
    const updatedConversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    emitConversationUpdated(this.eventEmitter, updatedConversation.id);
    return new ConversationDto({
      conversation: updatedConversation,
      contextUserId: actingUserId,
    });
  }

  private async softDeleteParticipants(
    participants: Participant[],
  ): Promise<void> {
    await softDeleteCascade(this.participantRepository.manager, {
      target: Participant,
      ids: participants.map((participant) => participant.id),
    });
  }

  async leaveConversation(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail({
      conversationId,
      userId,
    });
    const conversation = loadedParticipantConversation(participant);
    if (!conversationTypesUsersCanLeave[conversation.type]) {
      throw new ForbiddenException("This conversation can't be left.");
    }
    await this.softDeleteParticipants([participant]);
    const updatedConversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    emitConversationUpdated(this.eventEmitter, updatedConversation.id);
    return new ConversationDto({
      conversation: updatedConversation,
      contextUserId: userId,
    });
  }

  async markConversationRead(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.getParticipantOrFail({
      conversationId,
      userId,
    });

    const lastMessage = await findLastMessage(
      this.messageRepository,
      conversationId,
    );

    if (
      lastMessage &&
      !(await updateLive(this.participantRepository.manager, {
        target: Participant,
        id: participant.id,
        changes: { lastReadMessage: { id: lastMessage.id } },
      }))
    ) {
      throw notInConversation();
    }

    const conversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    const unreadCount = await this.unreadService.countUnreadForConversation(
      conversationId,
      userId,
    );
    emitConversationUpdated(this.eventEmitter, conversation.id);

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
    return (await this.findParticipant({ conversationId, userId })) !== null;
  }

  private ensureMembersEditable(conversation: Conversation) {
    if (!conversationTypesWithEditableMembers[conversation.type]) {
      throw new ForbiddenException(
        "This conversation's members cannot be changed.",
      );
    }
  }

  private async ensureConversationAdmin(
    conversationId: number,
    userId: number,
  ): Promise<Participant> {
    const participant = await this.getParticipantOrFail({
      conversationId,
      userId,
    });
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
      loadedUserCommunities(user).map((community) =>
        this.communityConversationService.syncCommunityConversationMembers(
          community.id,
        ),
      ),
    );
  }

  async getParticipantOrFail({
    conversationId,
    userId,
    relations = this.participantRelations,
  }: ParticipantLookup): Promise<Participant> {
    const participant = await this.findParticipant({
      conversationId,
      userId,
      relations,
    });

    if (!participant) {
      throw notInConversation();
    }

    return participant;
  }

  private findParticipant({
    conversationId,
    userId,
    relations,
  }: ParticipantLookup): Promise<Participant | null> {
    return this.participantRepository.findOne({
      where: {
        conversation: { id: conversationId },
        user: { id: userId },
      },
      relations,
    });
  }

  private async buildConversationDto(
    conversationId: number,
    contextUserId?: number,
  ): Promise<ConversationDto> {
    const conversation = await loadConversation(
      this.conversationRepository,
      conversationId,
    );
    const lastMessage = await findLastMessage(
      this.messageRepository,
      conversationId,
    );
    const unreadCount = contextUserId
      ? await this.unreadService.countUnreadForConversation(
          conversationId,
          contextUserId,
        )
      : 0;
    return new ConversationDto({
      conversation,
      contextUserId,
      lastMessage,
      unreadCount,
    });
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

  private async touchConversation(conversationId: number) {
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });
  }

  private isConversationAdmin(participant: Participant): boolean {
    return rolesWithAdminPowers[participant.role];
  }
}

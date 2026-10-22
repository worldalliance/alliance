import {
  ConversationType,
  conversationTypesUsersCanLeave,
  conversationTypesWithEditableMembers,
} from "@alliance/common/conversationType";
import { ParticipantRole } from "@alliance/common/participantRole";
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
import { User } from "src/user/entities/user.entity";
import { UserEvents, type FriendsAcceptedPayload } from "src/user/user.events";
import { isUniqueViolation } from "src/utils/db-errors";
import { In, IsNull, type Repository } from "typeorm";
import { ConversationService } from "./conversation.service";
import {
  ConversationDto,
  ConversationParticipantDto,
} from "./dto/messaging.dto";
import {
  Conversation,
  loadedConversationParticipants,
} from "./entities/conversation.entity";
import {
  loadedParticipantConversation,
  loadedParticipantUser,
  Participant,
  ParticipantState,
} from "./entities/participant.entity";
import { loadConversation } from "./load-conversation";
import { emitConversationUpdated } from "./messaging.events";
import { notInConversation } from "./not-in-conversation";

@Injectable()
export class ConversationMembershipService {
  private readonly logger = new Logger(ConversationMembershipService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly conversationService: ConversationService,
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

  async acceptInvite(
    conversationId: number,
    userId: number,
  ): Promise<ConversationDto> {
    const participant = await this.conversationService.getParticipantOrFail({
      conversationId,
      userId,
    });

    if (participant.state === ParticipantState.Joined) {
      return this.conversationService.getConversationForUser(
        conversationId,
        userId,
      );
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
    return this.conversationService.getConversationForUser(
      conversationId,
      userId,
    );
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
    const participant = await this.conversationService.getParticipantOrFail({
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

  async addParticipantToConversation(
    conversationId: number,
    actingUserId: number,
    dto: ConversationParticipantDto,
  ): Promise<ConversationDto> {
    const adminParticipant =
      await this.conversationService.ensureConversationAdmin(
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
      return this.conversationService.getConversationForUser(
        conversationId,
        actingUserId,
      );
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
      return this.conversationService.getConversationForUser(
        conversationId,
        actingUserId,
      );
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
    const adminParticipant =
      await this.conversationService.ensureConversationAdmin(
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
    const participant = await this.conversationService.getParticipantOrFail({
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

  private ensureMembersEditable(conversation: Conversation) {
    if (!conversationTypesWithEditableMembers[conversation.type]) {
      throw new ForbiddenException(
        "This conversation's members cannot be changed.",
      );
    }
  }

  private async touchConversation(conversationId: number) {
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });
  }
}

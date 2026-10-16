import { ConversationType } from "@alliance/common/conversationType";
import { ParticipantRole } from "@alliance/common/participantRole";
import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import {
  assertLive,
  lockLive,
  softDeleteCascade,
  softDeleteWhere,
  updateLive,
} from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager, Repository } from "typeorm";
import {
  Conversation,
  loadedConversationParticipants,
} from "./entities/conversation.entity";
import {
  loadedParticipantUser,
  Participant,
  ParticipantState,
} from "./entities/participant.entity";
import { conversationRelations, loadConversation } from "./load-conversation";
import { emitConversationUpdated } from "./messaging.events";

@Injectable()
export class CommunityConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
      relations: conversationRelations,
    });

    const photo = community.photo ?? null;

    if (!conversation) {
      conversation = await this.conversationRepository.manager.transaction(
        async (manager) => {
          // A group deleted since it was read would otherwise get a live chat.
          await assertLive(manager, {
            rows: [{ target: Community, id: community.id }],
            gone: () => new NotFoundException("Community not found."),
          });
          return manager.save(
            manager.create(Conversation, {
              title: community.name,
              photo,
              type: ConversationType.Community,
              community,
            }),
          );
        },
      );
    } else {
      const needsUpdate =
        conversation.title !== community.name || conversation.photo !== photo;
      if (needsUpdate) {
        await updateLive(this.conversationRepository.manager, {
          target: Conversation,
          id: conversation.id,
          changes: { title: community.name, photo },
          notFound: "Community not found.",
        });
      }
    }

    conversation = await loadConversation(
      this.conversationRepository,
      conversation.id,
    );

    const desiredUsers = new Map<number, User>();
    (community.users ?? []).forEach((user) => desiredUsers.set(user.id, user));
    (community.leaders ?? []).forEach((user) =>
      desiredUsers.set(user.id, user),
    );

    const leaderIds = new Set(
      (community.leaders ?? []).map((leader) => leader.id),
    );

    const participantMap = new Map<number, Participant>(
      loadedConversationParticipants(conversation).map((participant) => [
        loadedParticipantUser(participant).id,
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
        if (!shouldUpdate) continue;
        existing.joinedAt = existing.joinedAt ?? now;
        if (
          await updateLive(this.participantRepository.manager, {
            target: Participant,
            id: existing.id,
            changes: {
              role: existing.role,
              state: existing.state,
              joinedAt: existing.joinedAt,
            },
          })
        ) {
          continue;
        }
      }
      await this.participantRepository.manager.transaction(async (manager) => {
        await assertLive(manager, {
          rows: [{ target: Conversation, id: conversation.id }],
          gone: () => new NotFoundException("Community not found."),
        });
        if (!(await lockLive(manager, [{ target: User, id: userId }]))) {
          return;
        }
        await manager.save(
          manager.create(Participant, {
            conversation,
            user,
            role,
            state: ParticipantState.Joined,
            joinedAt: now,
          }),
        );
      });
    }

    const removable = loadedConversationParticipants(conversation).filter(
      (participant) => !desiredUsers.has(loadedParticipantUser(participant).id),
    );
    await softDeleteCascade(this.participantRepository.manager, {
      target: Participant,
      ids: removable.map((participant) => participant.id),
    });

    const updatedConversation = await loadConversation(
      this.conversationRepository,
      conversation.id,
    );
    emitConversationUpdated(this.eventEmitter, updatedConversation.id);
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
        await softDeleteWhere(manager, {
          target: Participant,
          where: {
            conversation: { id: sourceConversation.id },
            user: { id: user.id },
          },
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
          photo: destinationCommunity.photo ?? null,
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
    if (
      existingParticipant &&
      (await updateLive(participantRepository.manager, {
        target: Participant,
        id: existingParticipant.id,
        changes: { role, state: ParticipantState.Joined },
      }))
    ) {
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
}

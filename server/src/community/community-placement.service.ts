import { acceptsStaffAssignment } from "@alliance/common/community";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { writeUnderLive } from "src/datasources/soft-delete";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  communityDestination,
  group,
  member,
  notifMessage,
} from "src/notifs/notification-content";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { groupUrl } from "src/search/approutes";
import { User } from "src/user/entities/user.entity";
import { IsNull, type Repository } from "typeorm";
import { changeMembers } from "./change-members";
import { CommunityMembershipService } from "./community-membership.service";
import {
  COMMUNITY_DEFAULT_RELATIONS,
  CommunityService,
} from "./community.service";
import { groupJoinAudience, staffAddedMemberNotif } from "./community.utils";
import { Community, loadedCommunityUsers } from "./entities/community.entity";
import { GroupJoinNotifsService } from "./group-join-notifs.service";

@Injectable()
export class CommunityPlacementService {
  private readonly logger = new Logger(CommunityPlacementService.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
    private readonly communityConversationService: CommunityConversationService,
    private readonly notifsService: NotifsService,
    private readonly groupJoinNotifsService: GroupJoinNotifsService,
  ) {}

  async addUserToCommunityAdmin(params: {
    communityId: number;
    userId: number;
  }): Promise<Community> {
    return this.placeUserInCommunityAdmin({
      userId: params.userId,
      destinationCommunityId: params.communityId,
    });
  }

  async moveUserBetweenCommunitiesAdmin(params: {
    sourceCommunityId: number;
    destinationCommunityId: number;
    userId: number;
  }): Promise<void> {
    const { sourceCommunityId, destinationCommunityId, userId } = params;
    if (sourceCommunityId === destinationCommunityId) {
      throw new BadRequestException("Source and destination must be different");
    }

    await this.placeUserInCommunityAdmin({
      sourceCommunityId,
      destinationCommunityId,
      userId,
    });
  }

  private async placeUserInCommunityAdmin(params: {
    sourceCommunityId?: number;
    destinationCommunityId: number;
    userId: number;
  }): Promise<Community> {
    const { sourceCommunityId, destinationCommunityId, userId } = params;

    const { sourceCommunity, destinationCommunity, destinationUsers, user } =
      await this.communityRepository.manager.transaction(async (manager) => {
        const communityRepository = manager.getRepository(Community);
        const userRepository = manager.getRepository(User);
        const user = await userRepository.findOneOrFail({
          where: { id: userId },
          lock: { mode: "pessimistic_write" },
        });

        const communityIds = Array.from(
          new Set(
            sourceCommunityId === undefined
              ? [destinationCommunityId]
              : [sourceCommunityId, destinationCommunityId],
          ),
        ).sort((a, b) => a - b);
        for (const id of communityIds) {
          await communityRepository.findOneOrFail({
            where: { id },
            select: { id: true },
            lock: { mode: "pessimistic_write" },
          });
        }

        const sourceCommunity =
          sourceCommunityId === undefined
            ? null
            : await communityRepository.findOneOrFail({
                where: { id: sourceCommunityId },
                relations: COMMUNITY_DEFAULT_RELATIONS,
              });
        const destinationCommunity = await communityRepository.findOneOrFail({
          where: { id: destinationCommunityId },
          relations: COMMUNITY_DEFAULT_RELATIONS,
        });

        if (
          sourceCommunity &&
          !loadedCommunityUsers(sourceCommunity).some(
            (member) => member.id === userId,
          )
        ) {
          throw new BadRequestException(
            `${user.name} is not a member of ${sourceCommunity.name}`,
          );
        }
        if (sourceCommunity?.leaders?.some((leader) => leader.id === userId)) {
          throw new BadRequestException(
            "Group leaders cannot be moved without first removing their leader role",
          );
        }
        const destinationMembers = loadedCommunityUsers(destinationCommunity);
        if (destinationMembers.some((member) => member.id === userId)) {
          throw new BadRequestException(
            `${user.name} is already a member of ${destinationCommunity.name}`,
          );
        }
        if (!acceptsStaffAssignment(destinationCommunity)) {
          throw new BadRequestException(
            `Group ${destinationCommunity.name} is full or does not accept staff assignments`,
          );
        }

        await this.communityMembershipService.assertUsersHaveActiveContracts([
          user,
        ]);
        const destinationUsers = [...destinationMembers, user];
        if (sourceCommunity) {
          await changeMembers({
            manager,
            communityId: sourceCommunity.id,
            relation: "users",
            remove: [userId],
          });
        }
        await changeMembers({
          manager,
          communityId: destinationCommunity.id,
          relation: "users",
          add: [userId],
        });
        await userRepository.update(
          { id: user.id, deletedAt: IsNull() },
          { undergoingGroupAssignment: false, pendingCommunity: null },
        );
        await this.communityConversationService.placeCommunityConversationParticipant(
          {
            manager,
            user,
            sourceCommunity,
            destinationCommunity,
          },
        );

        return {
          sourceCommunity,
          destinationCommunity,
          destinationUsers,
          user,
        };
      });

    const destinationLeaderNotifs: CreateNotifParams[] = (
      destinationCommunity.leaders ?? []
    ).map((leader) =>
      staffAddedMemberNotif({
        leader,
        joiner: user,
        community: destinationCommunity,
      }),
    );
    const sourceLeaderNotifs: CreateNotifParams[] = sourceCommunity
      ? (sourceCommunity.leaders ?? []).map((leader) => ({
          user: leader,
          category: NotificationCategory.RemovedFromCommunityForLeader,
          message: notifMessage`Alliance staff removed ${member(user)} from your group (${group(sourceCommunity)})`,
          destination: communityDestination(sourceCommunity.id),
          webAppLocation: groupUrl({
            tab: "members",
            communityId: sourceCommunity.id,
          }),
          associatedUsers: [user],
        }))
      : [];
    const memberNotif: CreateNotifParams = {
      user,
      category: NotificationCategory.CommunityAssigned,
      message: sourceCommunity
        ? notifMessage`Alliance staff moved you from ${group(sourceCommunity)} to ${group(destinationCommunity)}`
        : notifMessage`Alliance staff assigned you to ${group(destinationCommunity)}`,
      destination: communityDestination(destinationCommunity.id),
      webAppLocation: groupUrl({ communityId: destinationCommunity.id }),
      associatedUsers: [],
    };
    const affectedCommunityIds = sourceCommunity
      ? [sourceCommunity.id, destinationCommunity.id]
      : [destinationCommunity.id];

    await this.settlePostCommitMembershipEffects([
      ...affectedCommunityIds.map((communityId) => ({
        description: `sync community conversation ${communityId}`,
        run: () =>
          this.communityConversationService.syncCommunityConversationMembers(
            communityId,
          ),
      })),
      {
        description: `send membership notifications for user ${user.id}`,
        run: () =>
          this.notifsService.sendNotifs([
            ...destinationLeaderNotifs,
            ...sourceLeaderNotifs,
            memberNotif,
          ]),
      },
      {
        description: `send group join notifications for user ${user.id}`,
        run: () =>
          this.groupJoinNotifsService.notify({
            community: destinationCommunity,
            joiners: [user],
            audience: groupJoinAudience(destinationCommunity),
          }),
      },
    ]);

    return { ...destinationCommunity, users: destinationUsers };
  }

  private async settlePostCommitMembershipEffects(
    effects: { description: string; run: () => Promise<unknown> }[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      effects.map((effect) => effect.run()),
    );
    results.forEach((result, index) => {
      switch (result.status) {
        case "fulfilled":
          break;
        case "rejected":
          this.logger.error(
            `Post-commit membership effect failed: ${effects[index].description}`,
            result.reason,
          );
          break;
        default:
          result satisfies never;
      }
    });
  }

  async addLeaderAdmin(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const [community, user] = await Promise.all([
      this.communityService.findOneOrFail(communityId),
      this.userRepository.findOneOrFail({ where: { id: userId } }),
    ]);

    const audience = groupJoinAudience(community);
    const existingLeaders = community.leaders!.filter(
      (leader) => leader.id !== userId,
    );
    const members = loadedCommunityUsers(community);
    const isMember = members.some((existing) => existing.id === userId);
    const isLeader = community.leaders!.some(
      (existing) => existing.id === userId,
    );
    const joined = await writeUnderLive(this.communityRepository.manager, {
      parents: [
        { target: User, id: userId },
        { target: Community, id: communityId },
      ],
      write: async (manager) => {
        const added = await changeMembers({
          manager,
          communityId,
          relation: "users",
          add: [userId],
        });
        await changeMembers({
          manager,
          communityId,
          relation: "leaders",
          add: [userId],
        });
        return added.includes(userId);
      },
    });
    if (!isMember) members.push(user);
    if (!isLeader) community.leaders!.push(user);

    await this.settlePostCommitMembershipEffects([
      ...(joined
        ? [
            {
              description: `send group join notifications for user ${user.id}`,
              run: () =>
                this.groupJoinNotifsService.notify({
                  community,
                  joiners: [user],
                  audience,
                }),
            },
            {
              description: `send leader notifications for user ${user.id}`,
              run: () =>
                this.notifsService.sendNotifs(
                  existingLeaders.map((leader) =>
                    staffAddedMemberNotif({ leader, joiner: user, community }),
                  ),
                ),
            },
          ]
        : []),
      {
        description: `sync community conversation ${communityId}`,
        run: () =>
          this.communityConversationService.syncCommunityConversationMembers(
            communityId,
          ),
      },
    ]);
    return community;
  }

  async removeLeaderAdmin(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.communityService.findOneOrFail(communityId);

    await writeUnderLive(this.communityRepository.manager, {
      parents: [{ target: Community, id: communityId }],
      write: (manager) =>
        changeMembers({
          manager,
          communityId,
          relation: "leaders",
          remove: [userId],
        }),
    });
    community.leaders = (community.leaders ?? []).filter(
      (leader) => leader.id !== userId,
    );

    await this.communityConversationService.syncCommunityConversationMembers(
      communityId,
    );
    return community;
  }
}

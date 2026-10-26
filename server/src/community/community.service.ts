/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  acceptsPublicJoin,
  checkCommunityAccessRules,
} from "@alliance/common/community";
import { DEFAULT_TIME_ZONE } from "@alliance/common/timezone";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  memberRemovedFromYourGroupMessage,
  removedFromGroupMessage,
} from "src/notifs/notif-copy";
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
import { CommunityMemberContactInfo } from "src/user/dto/user-action-relations.dto";
import { loadedUserCommunities, User } from "src/user/entities/user.entity";
import type { Relations } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import {
  CommunityMembershipService,
  ContractRefusalAudience,
} from "./community-membership.service";
import { canManageCommunity } from "./community-permissions";
import {
  memberJoinedCommunityNotif,
  memberLeftCommunityNotif,
} from "./community.utils";
import { CreateCommunityDto, UpdateCommunityDto } from "./dto/community.dto";
import { Community, loadedCommunityUsers } from "./entities/community.entity";

/**
 * The check constraints on {@link Community}, applied before the write so a row
 * that breaks one is a 400 and not a 500.
 */
function assertCommunityAccessRules(
  community: Pick<
    Community,
    "public" | "allowMemberInvites" | "allowStaffAssignments" | "maxCapacity"
  >,
): void {
  const checked = checkCommunityAccessRules(community);
  if (!checked.ok) {
    throw new BadRequestException(checked.error);
  }
}

export const COMMUNITY_DEFAULT_RELATIONS: Readonly<Relations<Community>> =
  Object.freeze({
    users: true,
    leaders: true,
  });

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityConversationService: CommunityConversationService,
    private readonly imagesService: ImagesService,
    private readonly notifsService: NotifsService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  async findOneOrFail(
    id: number,
    relations?: Relations<Community>,
  ): Promise<Community> {
    return this.communityRepository.findOneOrFail({
      where: { id },
      relations: relations ?? COMMUNITY_DEFAULT_RELATIONS,
    });
  }

  async findOne(
    id: number,
    relations?: Relations<Community>,
  ): Promise<Community | null> {
    return this.communityRepository.findOne({
      where: { id },
      relations: relations ?? COMMUNITY_DEFAULT_RELATIONS,
    });
  }

  async createCommunityAdmin(body: CreateCommunityDto): Promise<Community> {
    const photo = await this.imagesService.resolvePhotoUpdate(body.photo);
    const community = this.communityRepository.create({ ...body, photo });
    assertCommunityAccessRules(community);
    const savedCommunity = await this.communityRepository.save(community);
    await this.communityConversationService.syncCommunityConversationMembers(
      savedCommunity.id,
    );
    return savedCommunity;
  }

  async createCommunity(
    userId: number,
    body: CreateCommunityDto,
  ): Promise<Community> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    const photo = await this.imagesService.resolvePhotoUpdate(body.photo);

    const community = this.communityRepository.create({
      ...body,
      photo,
      leaders: [user],
      users: [user],
    });
    assertCommunityAccessRules(community);
    const savedCommunity = await writeUnderLive(
      this.communityRepository.manager,
      {
        parents: [{ target: User, id: userId }],
        write: (manager) => manager.save(community),
      },
    );
    await this.communityConversationService.syncCommunityConversationMembers(
      savedCommunity.id,
    );
    return savedCommunity;
  }

  async findAllCommunities(): Promise<Community[]> {
    const communities = await this.communityRepository.find({
      relations: {
        ...COMMUNITY_DEFAULT_RELATIONS,
        users: { contractEvents: true } as const,
      },
    });
    return communities.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findPublicCommunities(): Promise<Community[]> {
    const communities = await this.communityRepository.find({
      where: {
        public: true,
      },
      relations: COMMUNITY_DEFAULT_RELATIONS,
    });
    return communities.sort((a, b) => a.name.localeCompare(b.name));
  }

  async joinPublicCommunity(
    userId: number,
    communityId: number,
  ): Promise<Community> {
    const community = await this.communityRepository.findOneOrFail({
      where: {
        id: communityId,
        public: true,
      },
      relations: {
        users: true,
        leaders: true,
      },
    });

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
      relations: {
        communities: { leaders: true, users: true },
      },
    });

    if (
      loadedCommunityUsers(community).some((existing) => existing.id === userId)
    ) {
      throw new BadRequestException(
        "User is already a member of this community",
      );
    }

    if (!acceptsPublicJoin(community)) {
      throw new BadRequestException("Community is full");
    }

    await Promise.all([
      this.communityMembershipService.addUsersToCommunityAndRefreshConversation(
        {
          user,
          community,
          contractRefusalAudience: ContractRefusalAudience.Self,
          notifForLeader: ({ leader }) =>
            memberJoinedCommunityNotif({
              leader,
              joiner: user,
              community,
              message: notifMessage`${member(user)} joined your public group (${group(community)})`,
            }),
        },
      ),
      this.communityMembershipService.leaveOtherCommunitiesOnJoin(user),
    ]);

    return { ...community, users: [...loadedCommunityUsers(community), user] };
  }

  async updateCommunity(
    communityId: number,
    body: UpdateCommunityDto,
    userId: number,
  ): Promise<Community> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    if (!canManageCommunity(user, communityId)) {
      throw new BadRequestException();
    }

    const community = await this.findOneOrFail(communityId);

    const { name, photo, ...updateData } = body;

    community.name = name ?? community.name;

    const nextPhoto = await this.imagesService.resolvePhotoUpdate(photo);

    Object.assign(community, updateData);
    if (nextPhoto !== undefined) {
      community.photo = nextPhoto;
    }

    assertCommunityAccessRules(community);

    // The access rules go together, as validated, so concurrent edits cannot
    // combine into a set that breaks them.
    await updateLive(this.communityRepository.manager, {
      target: Community,
      id: communityId,
      changes: {
        name: community.name,
        description: community.description,
        photo: community.photo,
        public: community.public,
        allowMemberInvites: community.allowMemberInvites,
        allowStaffAssignments: community.allowStaffAssignments,
        maxCapacity: community.maxCapacity,
      } satisfies Record<keyof UpdateCommunityDto, unknown>,
      notFound: "Community not found",
    });
    await this.communityConversationService.syncCommunityConversationMembers(
      communityId,
    );
    return community;
  }

  async removeUserFromCommunity(params: {
    userId: number;
    removeeId: number;
    communityId: number;
  }) {
    const { userId, removeeId, communityId } = params;

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    if (!user.leaderOfIdSet.has(communityId)) {
      throw new BadRequestException();
    }
    if (userId === removeeId) {
      throw new BadRequestException(
        "You cannot remove yourself from your own community",
      );
    }

    const [community, removee] = await Promise.all([
      this.findOneOrFail(communityId),
      this.userRepository.findOneOrFail({
        where: { id: removeeId },
      }),
    ]);

    const updatedCommunityP =
      this.communityMembershipService.removeUserFromCommunityAndRefreshConversation(
        {
          user: removee,
          community,
          removeAsLeader: true,
          notifForLeader: ({ leader }) => {
            if (leader.id === user.id) {
              // do not notify self
              return null;
            }

            return {
              user: leader,
              category: NotificationCategory.RemovedFromCommunityForLeader,
              message: memberRemovedFromYourGroupMessage({
                remover: user,
                removee,
                community,
              }),
              destination: communityDestination(community.id),
              webAppLocation: groupUrl({
                tab: "members",
                communityId: community.id,
              }),
              associatedUsers: [removee, user],
            };
          },
          saveAsPendingCommunity: false,
        },
      );

    const notif: CreateNotifParams = {
      user: removee,
      category: NotificationCategory.RemovedFromCommunity,
      message: removedFromGroupMessage(user, community),
      destination: null,
      webAppLocation: groupUrl({
        tab: "groups",
      }),
      associatedUsers: [user],
    };
    const [updatedCommunity] = await Promise.all([
      updatedCommunityP,
      this.notifsService.sendNotif(notif),
    ]);

    return updatedCommunity;
  }

  async removeUserFromCommunityAdmin(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.findOneOrFail(communityId);
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    const updatedCommunityP =
      this.communityMembershipService.removeUserFromCommunityAndRefreshConversation(
        {
          user,
          community,
          removeAsLeader: true,
          notifForLeader: ({ leader }) => {
            return {
              user: leader,
              category: NotificationCategory.RemovedFromCommunityForLeader,
              message: notifMessage`Alliance staff removed ${member(user)} from your group (${group(community)})`,
              destination: communityDestination(community.id),
              webAppLocation: groupUrl({
                tab: "members",
                communityId: community.id,
              }),
              associatedUsers: [user],
            };
          },
          saveAsPendingCommunity: false,
        },
      );

    const notifP = this.notifsService.sendNotif({
      user,
      category: NotificationCategory.RemovedFromCommunity,
      message: notifMessage`Alliance staff removed you from your group (${group(community)})`,
      destination: null,
      webAppLocation: groupUrl({
        tab: "groups",
      }),
      associatedUsers: [],
    });

    const [updatedCommunity] = await Promise.all([updatedCommunityP, notifP]);
    return updatedCommunity;
  }

  async leaveCommunity(communityId: number, userId: number): Promise<void> {
    const community = await this.communityRepository.findOneOrFail({
      where: {
        id: communityId,
      },
      relations: {
        users: true,
        leaders: true,
      },
    });
    const user = loadedCommunityUsers(community).find(
      (user) => user.id === userId,
    );
    if (!user) {
      throw new BadRequestException("User not found in community");
    }
    if (
      community.leaders!.length === 1 &&
      community.leaders![0].id === userId
    ) {
      throw new BadRequestException(
        "You cannot leave as the last leader of the community",
      );
    }

    await this.communityMembershipService.removeUserFromCommunityAndRefreshConversation(
      {
        user,
        community,
        removeAsLeader: true,
        notifForLeader: ({ leader }) =>
          memberLeftCommunityNotif({ leader, leaver: user, community }),
        saveAsPendingCommunity: false,
      },
    );
  }

  async deleteCommunity(userId: number, communityId: number): Promise<void> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId, communities: { id: communityId } },
      relations: { communities: { users: true } },
    });
    if (!user.leaderOfIds.some((cid) => cid === communityId)) {
      throw new BadRequestException();
    }
    const communities = loadedUserCommunities(user);
    if (!communities.length) {
      throw new NotFoundException();
    }
    if (communities.length !== 1) {
      throw new InternalServerErrorException("Multiple communities found");
    }
    const community = communities[0];
    if (loadedCommunityUsers(community).some((user) => user.id !== userId)) {
      throw new BadRequestException(
        "User cannot delete community with other members",
      );
    }
    await this.softDeleteCommunity(communityId);
  }

  async deleteCommunityAdmin(communityId: number): Promise<void> {
    await this.softDeleteCommunity(communityId);
  }

  private async softDeleteCommunity(communityId: number): Promise<void> {
    await softDeleteWhere(this.communityRepository.manager, {
      target: Community,
      where: { id: communityId },
    });
  }

  async findUserCommunities(userId: number): Promise<Community[]> {
    const user = await this.userRepository.findOneOrFail({
      where: {
        id: userId,
      },
      relations: {
        communities: {
          users: {
            contractEvents: true,
          },
          leaders: true,
        },
      },
    });
    function leaderKey(community: Community) {
      return (community.leaders?.some((leader) => leader.id === userId) ??
        false)
        ? 0
        : 1;
    }
    return loadedUserCommunities(user).sort(
      (a, b) => leaderKey(a) - leaderKey(b),
    );
  }

  async getAllMemberContactInfoAdmin(): Promise<CommunityMemberContactInfo[]> {
    const users = await this.userRepository.find({
      relations: { awayRanges: true },
    });

    return users.map((user) => ({ user, timeZone: DEFAULT_TIME_ZONE }));
  }

  async getMemberContactInfo(params: {
    leaderId?: number;
    communityId: number;
  }): Promise<CommunityMemberContactInfo[]> {
    const { leaderId, communityId } = params;

    const leaderP =
      leaderId !== undefined
        ? this.userRepository.findOneOrFail({
            where: { id: leaderId },
          })
        : null;
    const community = await this.findOneOrFail(communityId, {
      users: {
        awayRanges: true,
      },
      leaders: true,
    });

    if (
      leaderId !== undefined &&
      !community.leaders!.some((leader) => leader.id === leaderId)
    ) {
      throw new BadRequestException("User is not a leader of this community");
    }

    const leader = await leaderP;
    const timeZone = leader?.timeZone ?? DEFAULT_TIME_ZONE;
    return loadedCommunityUsers(community).map((user) => ({ user, timeZone }));
  }

  /**
   * Finds all community leaders whose communities contain any of the given users.
   *
   * This does not include themselves, unless there is another user in the same community.
   */
  async findLeadersOfCommunitiesWithUsers(userIds: number[]): Promise<User[]> {
    const communities = await this.communityRepository.find({
      where: {
        users: {
          id: In(userIds),
        },
      },
      relations: { leaders: { contractEvents: true }, users: true },
    });

    const leadersById = new Map<number, User>(
      communities.flatMap((community) =>
        community.leaders!.map((leader) => [leader.id, leader]),
      ),
    );

    const leadersWithUsers = new Set<number>(
      communities.flatMap((community) =>
        community
          .leaders!.filter((leader) =>
            loadedCommunityUsers(community).some(
              (user) => user.id !== leader.id,
            ),
          )
          .map((leader) => leader.id),
      ),
    );

    return Array.from(leadersWithUsers.values()).map(
      (leaderId) => leadersById.get(leaderId)!,
    );
  }
}

/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  acceptsPublicJoin,
  acceptsStaffAssignment,
  checkCommunityAccessRules,
} from "@alliance/common/community";
import { run } from "@alliance/common/run";
import { DEFAULT_TIME_ZONE } from "@alliance/common/timezone";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  lockLiveIds,
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
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
import {
  CreateCommunityInviteDto,
  RequestCommunityInviteDto,
} from "src/user/dto/invite.dto";
import { CommunityMemberContactInfo } from "src/user/dto/user-action-relations.dto";
import {
  assertCanManageCommunity,
  canManageCommunity,
  loadedUserCommunities,
  sqlUserHasActiveContractAt,
  User,
} from "src/user/entities/user.entity";
import type { Relations } from "src/utils/Repository";
import { DeepPartial, In, IsNull, type Repository } from "typeorm";
import { changeMembers } from "./change-members";
import {
  groupJoinAudience,
  isCommunityLedBy,
  memberJoinedCommunityNotif,
  memberLeftCommunityNotif,
  staffAddedMemberNotif,
} from "./community.utils";
import { CreateCommunityDto, UpdateCommunityDto } from "./dto/community.dto";
import {
  CommunityInvite,
  CommunityInviteStatus,
  loadedCommunityInviteCommunity,
  loadedCommunityInviteInvitedUser,
} from "./entities/community-invite.entity";
import { Community, loadedCommunityUsers } from "./entities/community.entity";
import { GroupJoinNotifsService } from "./group-join-notifs.service";
import { saveInviteOfLiveParents, setLiveInviteStatus } from "./invite-writes";

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

const COMMUNITY_DEFAULT_RELATIONS: Readonly<Relations<Community>> =
  Object.freeze({
    users: true,
    leaders: true,
  });

/**
 * Who reads a refusal when someone lacks an active contract. The self-service
 * joins are telling a member about their own contract; the staff paths are
 * telling an admin which of someone else's blocked the request.
 */
export enum ContractRefusalAudience {
  Self = "self",
  Staff = "staff",
}

const CONTRACT_REFUSAL_MESSAGE: Record<
  ContractRefusalAudience,
  (blockedNames: string[]) => string
> = {
  [ContractRefusalAudience.Self]: () =>
    "You need an active contract to join a group.",
  [ContractRefusalAudience.Staff]: (blockedNames) =>
    `Cannot add members without an active contract to a group: ${blockedNames.join(", ")}`,
};

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(CommunityInvite)
    private readonly communityInviteRepository: Repository<CommunityInvite>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityConversationService: CommunityConversationService,
    private readonly imagesService: ImagesService,
    private readonly notifsService: NotifsService,
    private readonly groupJoinNotifsService: GroupJoinNotifsService,
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

  /**
   * Nobody joins a group without an active contract — membership is what
   * signing buys. This is the only path that adds ordinary members, so the rule
   * is enforced here rather than at each caller.
   *
   * It holds for members, not for leaders, who reach `users` by other routes:
   * {@link createCommunity} seeds it with the founder, and suspension keeps a
   * leader in the group it removes them as a member of (`removeAsLeader:
   * false`). So a group can hold a leader with no live contract; it should
   * never hold a plain member with none.
   *
   * `contractBeingSigned` exempts the callers inside
   * `ContractService.signContract`, which place the member right after writing
   * their SIGNED event. The event is dated by the app's clock and the check
   * compares it with the database's `NOW()`, so a clock running ahead would
   * refuse the member who just signed.
   */
  async addUsersToCommunityAndRefreshConversation(
    params: {
      community: Community;
      notifForLeader: (params: { leader: User }) => CreateNotifParams | null;
      contractBeingSigned?: boolean;
      /** Defaults to staff; the self-service joins add the requester. */
      contractRefusalAudience?: ContractRefusalAudience;
      /** Defaults to the group's members who don't lead it, as loaded. */
      groupJoinAudience?: User[];
    } & (
      | {
          user: Pick<User, "id" | "name" | "anonymous"> & DeepPartial<User>;
          users?: undefined;
        }
      | {
          user?: undefined;
          users: (Pick<User, "id" | "name" | "anonymous"> &
            DeepPartial<User>)[];
        }
    ),
  ): Promise<void> {
    const {
      user,
      users: usersParam,
      community,
      notifForLeader,
      contractBeingSigned = false,
      contractRefusalAudience = ContractRefusalAudience.Staff,
      groupJoinAudience: audience = groupJoinAudience(community),
    } = params;
    const users = usersParam ?? [user];

    const members = loadedCommunityUsers(community);
    const userIdSet = new Set(users.map((user) => user.id));
    if (members.some((existing) => userIdSet.has(existing.id))) {
      throw new BadRequestException(
        `One or more users are already a member of community ${community.id}`,
      );
    }
    if (!contractBeingSigned) {
      await this.assertUsersHaveActiveContracts(users, contractRefusalAudience);
    }

    const notifs: CreateNotifParams[] = community
      .leaders!.map((leader) => notifForLeader({ leader }))
      .filter((notif) => !!notif);

    const savedP = writeUnderLive(this.communityRepository.manager, {
      parents: [
        ...users.map((added) => ({ target: User, id: added.id })),
        { target: Community, id: community.id },
      ],
      write: (em) =>
        changeMembers({
          manager: em,
          communityId: community.id,
          relation: "users",
          add: users.map((added) => added.id),
        }),
    });
    const membershipP = run(async () => {
      await savedP;

      await this.communityConversationService.syncCommunityConversationMembers(
        community.id,
      );
    });
    await Promise.all([
      membershipP,
      savedP.then(async (addedIds) => {
        const joiners = users.filter((joiner) => addedIds.includes(joiner.id));
        if (joiners.length) {
          await this.groupJoinNotifsService.notify({
            community,
            joiners,
            audience,
          });
        }
      }),
      this.notifsService.sendNotifs(notifs),
      this.userRepository.update(
        { id: In(users.map((user) => user.id)), deletedAt: IsNull() },
        { undergoingGroupAssignment: false, pendingCommunity: null },
      ),
    ]);
  }

  /**
   * Public so a batch caller can clear its whole set before it starts
   * mutating; {@link addUsersToCommunityAndRefreshConversation} still checks
   * per-add, since that is where the invariant has to hold.
   */
  async assertUsersHaveActiveContracts(
    users: Pick<User, "id" | "name">[],
    audience: ContractRefusalAudience = ContractRefusalAudience.Staff,
  ): Promise<void> {
    const byId = new Map(users.map((user) => [user.id, user]));
    if (byId.size === 0) return;
    const rows = await this.userRepository
      .createQueryBuilder("u")
      .select("u.id", "id")
      .where("u.id IN (:...userIds)", { userIds: Array.from(byId.keys()) })
      .andWhere(sqlUserHasActiveContractAt("u.id", "NOW()"))
      .getRawMany<{ id: number }>();
    const signed = new Set(rows.map((row) => row.id));
    const blocked = Array.from(byId.values()).filter(
      (user) => !signed.has(user.id),
    );
    if (blocked.length) {
      throw new BadRequestException(
        CONTRACT_REFUSAL_MESSAGE[audience](blocked.map((user) => user.name)),
      );
    }
  }

  async removeUserFromCommunityAndRefreshConversation(
    params: {
      community: Community;
      removeAsLeader: boolean;
      notifForLeader: (params: { leader: User }) => CreateNotifParams | null;
      saveAsPendingCommunity: boolean;
    } & (
      | {
          user: User;
          users?: undefined;
        }
      | {
          user?: undefined;
          users: User[];
        }
    ),
  ): Promise<Community> {
    const {
      user,
      users: usersParam,
      community,
      removeAsLeader,
      notifForLeader,
      saveAsPendingCommunity,
    } = params;
    const users = usersParam ?? [user];
    const userIdSet = new Set(users.map((user) => user.id));

    const newLeaders = removeAsLeader
      ? community.leaders!.filter((l) => !userIdSet.has(l.id))
      : community.leaders!;

    const toKeepSet = removeAsLeader
      ? new Set()
      : new Set(community.leaders!.map((l) => l.id));
    const members = loadedCommunityUsers(community);
    const newMembers = members.filter(
      (u) => !userIdSet.has(u.id) || toKeepSet.has(u.id),
    );
    if (newMembers.length === members.length) {
      // users are not removed, no further action needed
      return community;
    }

    const notifs = newLeaders
      .map((leader) => notifForLeader({ leader }))
      .filter((notif) => !!notif);

    const updatedCommunityP = run(async () => {
      await this.communityRepository.manager.transaction(async (manager) => {
        // Accounts first: admin placement locks them before the group, and
        // deleting one locks it before its cascade reaches the membership rows.
        if (saveAsPendingCommunity) {
          await lockLiveIds(manager, { target: User, ids: [...userIdSet] });
        }
        await writeUnderLive(manager, {
          parents: [{ target: Community, id: community.id }],
          write: async (em) => {
            await changeMembers({
              manager: em,
              communityId: community.id,
              relation: "users",
              remove: members
                .filter((member) => !newMembers.includes(member))
                .map((member) => member.id),
            });
            await changeMembers({
              manager: em,
              communityId: community.id,
              relation: "leaders",
              remove: community
                .leaders!.filter((leader) => !newLeaders.includes(leader))
                .map((leader) => leader.id),
            });
            if (saveAsPendingCommunity) {
              await em.update(
                User,
                { id: In(users.map((user) => user.id)), deletedAt: IsNull() },
                { pendingCommunity: { id: community.id } },
              );
            }
          },
        });
      });
      await this.communityConversationService.syncCommunityConversationMembers(
        community.id,
      );

      return { ...community, users: newMembers, leaders: newLeaders };
    });

    const [updatedCommunity] = await Promise.all([
      updatedCommunityP,
      this.notifsService.sendNotifs(notifs),
    ]);

    return updatedCommunity;
  }

  /**
   * A member who joins a group leaves every other group they belong to,
   * except the ones they lead. `user.communities` must be loaded with
   * `leaders` and `users`.
   */
  async leaveOtherCommunitiesOnJoin(user: User): Promise<void> {
    await Promise.all(
      loadedUserCommunities(user)
        .filter((community) => !isCommunityLedBy(community, user.id))
        .map((community) =>
          this.removeUserFromCommunityAndRefreshConversation({
            user,
            community,
            removeAsLeader: false,
            notifForLeader: ({ leader }) =>
              memberLeftCommunityNotif({ leader, leaver: user, community }),
            saveAsPendingCommunity: false,
          }),
        ),
    );
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
      this.addUsersToCommunityAndRefreshConversation({
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
      }),
      this.leaveOtherCommunitiesOnJoin(user),
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
      this.removeUserFromCommunityAndRefreshConversation({
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
            message: notifMessage`${member(user)} removed ${member(removee)} from your group (${group(community)})`,
            destination: communityDestination(community.id),
            webAppLocation: groupUrl({
              tab: "members",
              communityId: community.id,
            }),
            associatedUsers: [removee, user],
          };
        },
        saveAsPendingCommunity: false,
      });

    const notif: CreateNotifParams = {
      user: removee,
      category: NotificationCategory.RemovedFromCommunity,
      message: notifMessage`${member(user)} removed you from their group (${group(community)})`,
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
      this.removeUserFromCommunityAndRefreshConversation({
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
      });

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

    await this.removeUserFromCommunityAndRefreshConversation({
      user,
      community,
      removeAsLeader: true,
      notifForLeader: ({ leader }) =>
        memberLeftCommunityNotif({ leader, leaver: user, community }),
      saveAsPendingCommunity: false,
    });
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

        await this.assertUsersHaveActiveContracts([user]);
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
      this.findOneOrFail(communityId),
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
    const community = await this.findOneOrFail(communityId);

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

  async createCommunityInvite(
    body: CreateCommunityInviteDto,
    userId: number,
  ): Promise<CommunityInvite> {
    const { invitedUserId, communityId } = body;

    const invitedUser = await this.userRepository.findOneOrFail({
      where: { id: invitedUserId },
    });
    const community = await this.findOneOrFail(communityId);
    const invitingUser = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    if (!canManageCommunity(invitingUser, communityId)) {
      throw new BadRequestException("User is not a leader of this community");
    }

    const existingInvites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: invitedUserId },
        community: { id: communityId },
        deletedAt: IsNull(),
      },
    });
    if (
      existingInvites.some(
        (invite) => invite.status === CommunityInviteStatus.InviteePending,
      )
    ) {
      throw new BadRequestException(
        "User has already been invited to this community",
      );
    }

    const invite = await saveInviteOfLiveParents(
      this.communityInviteRepository.manager,
      this.communityInviteRepository.create({
        invitedUser,
        community,
        invitingUser,
        status: CommunityInviteStatus.InviteePending,
      }),
    );
    const notif: CreateNotifParams = {
      user: invitedUser,
      category: NotificationCategory.CommunityInviteCreated,
      message: notifMessage`${member(invitingUser)} invited you to join their group (${group(community)})`,
      destination: null,
      webAppLocation: groupUrl({
        tab: "groups",
      }),
      associatedUsers: [invitingUser],
      communityInvite: invite,
    };

    await this.notifsService.sendNotif(notif);
    return invite;
  }

  async deleteCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true, community: true },
    });
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    if (
      !(
        invite.invitingUser?.id === userId ||
        canManageCommunity(user, loadedCommunityInviteCommunity(invite).id)
      )
    ) {
      throw new BadRequestException();
    }
    await this.communityInviteRepository.update(inviteId, {
      deletedAt: new Date(),
    });
  }

  async requestCommunityInvite(
    body: RequestCommunityInviteDto,
    userId: number,
  ): Promise<CommunityInvite> {
    const { communityId, invitedUserId } = body;

    const invitingUserP = this.userRepository.findOne({
      where: { id: userId, communities: { id: communityId } },
    });
    const invitedUserP = this.userRepository.findOne({
      where: { id: invitedUserId },
      relations: {
        communities: true,
      },
    });
    const communityP = this.communityRepository.findOne({
      where: { id: communityId },
    });

    const existingInvites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: invitedUserId },
        community: { id: communityId },
        deletedAt: IsNull(),
      },
    });
    if (
      existingInvites.some(
        (invite) =>
          invite.status === CommunityInviteStatus.RequestPending ||
          invite.status === CommunityInviteStatus.InviteePending,
      )
    ) {
      throw new BadRequestException(
        "This user already has a pending invite to this community.",
      );
    }

    const invitedUser = await invitedUserP;
    if (!invitedUser) {
      throw new BadRequestException("Invited user not found");
    }
    if (loadedUserCommunities(invitedUser).some((c) => c.id === communityId)) {
      throw new BadRequestException(
        "Invited user is already a member of the community",
      );
    }

    const invitingUser = await invitingUserP;
    if (!invitingUser) {
      throw new BadRequestException("Inviting user not found");
    }

    const community = await communityP;
    if (!community) {
      throw new BadRequestException("Community not found");
    }
    const invite = this.communityInviteRepository.create({
      invitedUser,
      community,
      invitingUser,
      status: CommunityInviteStatus.RequestPending,
    });
    const savedInvite = await saveInviteOfLiveParents(
      this.communityInviteRepository.manager,
      invite,
    );

    sendNotificationToLeaders: {
      const communityWithLeaders = await this.communityRepository.findOne({
        where: { id: communityId },
        relations: { leaders: true },
      });
      if (!communityWithLeaders?.leaders?.length) {
        break sendNotificationToLeaders;
      }
      await this.notifsService.sendNotifs(
        communityWithLeaders.leaders.map(
          (leader) =>
            ({
              user: leader,
              category: NotificationCategory.CommunityInviteRequestCreated,
              message: notifMessage`${member(invitingUser)} requested an invite for ${member(invitedUser)} (${group(community)})`,
              destination: communityDestination(community.id),
              webAppLocation: groupUrl({
                tab: "invites",
                communityId: community.id,
              }),
              associatedUsers: [invitingUser, invitedUser],
              communityInvite: invite,
            }) satisfies CreateNotifParams,
        ),
      );
    }

    return savedInvite;
  }

  private async findPendingInviteRequestForManager(
    inviteId: number,
    userId: number,
  ): Promise<{ invite: CommunityInvite; user: User }> {
    const userP = this.userRepository.findOne({ where: { id: userId } });
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true, invitedUser: true, community: true },
    });

    if (invite.status !== CommunityInviteStatus.RequestPending) {
      throw new BadRequestException(
        `Invite is not a pending request. Status: ${JSON.stringify(
          invite.status,
        )}`,
      );
    }

    const user = await userP;
    if (!user) {
      throw new BadRequestException("User not found");
    }
    assertCanManageCommunity(user, loadedCommunityInviteCommunity(invite).id);

    return { invite, user };
  }

  async approveCommunityInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<CommunityInvite> {
    const { invite, user } = await this.findPendingInviteRequestForManager(
      inviteId,
      userId,
    );

    const invitedUser = loadedCommunityInviteInvitedUser(invite);
    const community = loadedCommunityInviteCommunity(invite);
    invite.status = CommunityInviteStatus.InviteePending;
    await setLiveInviteStatus(this.communityInviteRepository.manager, invite);

    await this.notifsService.sendNotifs([
      {
        user: invitedUser,
        category: NotificationCategory.CommunityInviteCreated,
        message: notifMessage`${member(invite.invitingUser ?? user)} invited you to join their group (${group(community)})`,
        destination: null,
        webAppLocation: groupUrl({
          tab: "groups",
        }),
        associatedUsers: [invite.invitingUser ?? user],
        communityInvite: invite,
      } satisfies CreateNotifParams,
      ...(invite.invitingUser
        ? [
            {
              user: invite.invitingUser,
              category: NotificationCategory.CommunityInviteCreated,
              message: notifMessage`Your request to invite ${member(invitedUser)} was approved`,
              destination: communityDestination(community.id),
              webAppLocation: groupUrl({
                tab: "groups",
                communityId: community.id,
              }),
              associatedUsers: [],
              communityInvite: invite,
            } satisfies CreateNotifParams,
          ]
        : []),
    ]);

    return invite;
  }

  async rejectCommunityInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<void> {
    const { invite, user } = await this.findPendingInviteRequestForManager(
      inviteId,
      userId,
    );

    const invitedUser = loadedCommunityInviteInvitedUser(invite);
    invite.status = CommunityInviteStatus.RequestRejected;
    await setLiveInviteStatus(this.communityInviteRepository.manager, invite);

    if (invite.invitingUser) {
      await this.notifsService.sendNotif({
        user: invite.invitingUser,
        category: NotificationCategory.CommunityInviteRequestRejected,
        message: notifMessage`Your request to invite ${member(invitedUser)} was rejected`,
        destination: null,
        webAppLocation: groupUrl({
          tab: "groups",
        }),
        associatedUsers: [user],
        communityInvite: invite,
      });
    }
  }

  async findCommunityInvites(
    userId: number,
    communityId: number,
  ): Promise<CommunityInvite[]> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    assertCanManageCommunity(user, communityId);
    const invites = await this.communityInviteRepository.find({
      where: { community: { id: communityId }, deletedAt: IsNull() },
      relations: { invitedUser: true, invitingUser: true, community: true },
    });
    return invites;
  }

  async findIncomingCommunityInvitesForUser(
    userId: number,
  ): Promise<CommunityInvite[]> {
    const invites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: userId },
        deletedAt: IsNull(),
      },
      relations: { invitedUser: true, invitingUser: true, community: true },
    });
    return invites;
  }

  async acceptCommunityInvite(
    inviteId: number,
    userId: number,
  ): Promise<number> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: {
        invitedUser: {
          communities: { leaders: true, users: true },
        },
        invitingUser: true,
        community: true,
        notifs: true,
      },
    });
    const invitedUser = loadedCommunityInviteInvitedUser(invite);
    if (invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.InviteePending) {
      throw new BadRequestException();
    }

    const community = await this.findOneOrFail(
      loadedCommunityInviteCommunity(invite).id,
    );

    if (
      loadedCommunityUsers(community).some((user) => user.id === invitedUser.id)
    ) {
      throw new BadRequestException();
    }
    // Before any write, so a refused join leaves the invite and the
    // invitee's current groups untouched.
    await this.assertUsersHaveActiveContracts(
      [invitedUser],
      ContractRefusalAudience.Self,
    );

    invite.status = CommunityInviteStatus.InviteeAccepted;
    await setLiveInviteStatus(this.communityInviteRepository.manager, invite);
    await Promise.all([
      this.addUsersToCommunityAndRefreshConversation({
        user: invitedUser,
        community,
        contractRefusalAudience: ContractRefusalAudience.Self,
        notifForLeader: ({ leader }) => {
          if (leader.id === invite.invitingUser?.id) {
            return null;
          }
          return memberJoinedCommunityNotif({
            leader,
            joiner: invitedUser,
            community,
            message: notifMessage`${member(invitedUser)} joined your group (${group(community)})`,
          });
        },
      }),
      this.leaveOtherCommunitiesOnJoin(invitedUser),
      ...invite.notifs!.map((notif) =>
        this.notifsService.setRead(notif.id, userId),
      ),
      this.notifsService.sendNotif({
        user: invite.invitingUser!,
        category: NotificationCategory.CommunityInviteAccepted,
        message: notifMessage`${member(invitedUser)} accepted your invitation to join your group (${group(community)})`,
        destination: communityDestination(community.id),
        webAppLocation: groupUrl({
          tab: "members",
          communityId: community.id,
        }),
        associatedUsers: [invitedUser],
        communityInvite: invite,
      }),
    ]);

    return community.id;
  }

  async rejectCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: {
        invitedUser: true,
        invitingUser: true,
        community: true,
        notifs: true,
      },
    });
    const invitedUser = loadedCommunityInviteInvitedUser(invite);
    const community = loadedCommunityInviteCommunity(invite);
    if (invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.InviteePending) {
      throw new BadRequestException();
    }
    invite.status = CommunityInviteStatus.InviteeRejected;
    await setLiveInviteStatus(this.communityInviteRepository.manager, invite);
    await Promise.all([
      ...invite.notifs!.map((notif) =>
        this.notifsService.setRead(notif.id, userId),
      ),
    ]);

    await this.notifsService.sendNotif({
      user: invite.invitingUser!,
      category: NotificationCategory.CommunityInviteRejected,
      message: notifMessage`${member(invitedUser)} declined your invitation to join your group (${group(community)})`,
      destination: communityDestination(community.id),
      webAppLocation: groupUrl({
        tab: "invites",
        communityId: community.id,
      }),
      associatedUsers: [invitedUser],
      communityInvite: invite,
    });
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

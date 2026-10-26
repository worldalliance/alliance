import { run } from "@alliance/common/run";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { lockLiveIds, writeUnderLive } from "src/datasources/soft-delete";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { sqlUserHasActiveContractAt } from "src/user/entities/contract-event.entity";
import { loadedUserCommunities, User } from "src/user/entities/user.entity";
import { DeepPartial, In, IsNull, type Repository } from "typeorm";
import { changeMembers } from "./change-members";
import {
  groupJoinAudience,
  isCommunityLedBy,
  memberLeftCommunityNotif,
} from "./community.utils";
import { Community, loadedCommunityUsers } from "./entities/community.entity";
import { GroupJoinNotifsService } from "./group-join-notifs.service";

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
export class CommunityMembershipService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityConversationService: CommunityConversationService,
    private readonly notifsService: NotifsService,
    private readonly groupJoinNotifsService: GroupJoinNotifsService,
  ) {}

  /**
   * Nobody joins a group without an active contract — membership is what
   * signing buys. Every other path that adds ordinary members comes through
   * here, except staff placement, which writes inside its own transaction and
   * calls {@link assertUsersHaveActiveContracts} itself.
   *
   * It holds for members, not for leaders, who reach `users` by other routes:
   * `CommunityService.createCommunity` seeds it with the founder, and
   * suspension keeps a leader in the group it removes them as a member of
   * (`removeAsLeader: false`). So a group can hold a leader with no live
   * contract; it should never hold a plain member with none.
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
}

import { freeSlots } from "@alliance/common/community";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommunityMembershipService } from "src/community/community-membership.service";
import {
  groupJoinAudience,
  memberJoinedCommunityNotif,
} from "src/community/community.utils";
import { Community } from "src/community/entities/community.entity";
import { updateLive } from "src/datasources/soft-delete";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { assignedToGroupMessage } from "src/notifs/notif-copy";
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
import { DataSource, In, type Repository } from "typeorm";
import { AssignGroupsDto } from "./dto/user.dto";
import { User } from "./entities/user.entity";

@Injectable()
export class GroupAssignmentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly notifsService: NotifsService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  async joinGroupAssignment(userId: number): Promise<void> {
    await updateLive(this.dataSource.manager, {
      target: User,
      id: userId,
      changes: { undergoingGroupAssignment: true },
      notFound: `User ${userId} not found`,
    });
  }

  async leaveGroupAssignment(userId: number): Promise<void> {
    await updateLive(this.dataSource.manager, {
      target: User,
      id: userId,
      changes: { undergoingGroupAssignment: false },
      notFound: `User ${userId} not found`,
    });
  }

  async findGroupAssignmentMembers(): Promise<User[]> {
    return this.userRepository.find({
      where: { undergoingGroupAssignment: true },
      relations: {
        communities: { leaders: true },
      },
    });
  }

  async assignGroupsAdmin(body: AssignGroupsDto): Promise<void> {
    const userIds = body.assignments.map(({ userId }) => userId);
    if (userIds.length !== new Set(userIds).size) {
      throw new BadRequestException(
        "Cannot assign the same user multiple times",
      );
    }

    const userByIdP = this.userRepository
      .find({
        where: {
          id: In(userIds),
          undergoingGroupAssignment: true,
        },
        relations: {
          communities: { leaders: true, users: true },
        },
      })
      .then((users) => new Map(users.map((user) => [user.id, user])));
    const communityByIdP = this.communityRepository
      .find({
        where: {
          id: In(body.assignments.map(({ communityId }) => communityId)),
        },
        relations: {
          users: true,
          leaders: true,
        },
      })
      .then(
        (communities) =>
          new Map(communities.map((community) => [community.id, community])),
      );

    const userById = await userByIdP;
    const communityById = await communityByIdP;

    // The loop below drops each member from their old groups before adding them
    // to the new one, and it is not transactional — so everything that can
    // refuse the batch has to refuse it here, before the first write. A throw
    // part-way through leaves earlier assignments applied and the member it
    // stopped on in no group at all.
    const assignments = body.assignments.map(({ userId, communityId }) => {
      const user = userById.get(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      const community = communityById.get(communityId);
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      return { user, community };
    });

    // Implies maxCapacity is non-null for everything left, per the check
    // constraint on Community.
    const closed = Array.from(communityById.values()).filter(
      (community) => !community.allowStaffAssignments,
    );
    if (closed.length) {
      throw new BadRequestException(
        `Cannot assign to groups that do not accept staff assignments: ${closed
          .map((community) => community.name)
          .join(", ")}`,
      );
    }

    const remainingSlots = new Map<number, number>();
    for (const { community } of assignments) {
      const remaining =
        remainingSlots.get(community.id) ?? freeSlots(community);
      if (remaining <= 0) {
        throw new BadRequestException(
          `Too many members assigned to community ${community.id}`,
        );
      }
      remainingSlots.set(community.id, remaining - 1);
    }

    // Queued members can lose their contract after they join the queue —
    // nothing clears `undergoingGroupAssignment` on suspension — so this is a
    // live rejection, not a formality.
    await this.communityMembershipService.assertUsersHaveActiveContracts(
      assignments.map(({ user }) => user),
    );

    // Taken before the loop, less the batch's members (who leave every group
    // they don't lead), so none of them hears of another whatever the order.
    const batchUserIds = new Set(userIds);
    const groupJoinAudiences = new Map(
      assignments.map(({ community }) => [
        community.id,
        groupJoinAudience(community).filter(
          (member) => !batchUserIds.has(member.id),
        ),
      ]),
    );

    const userNotifs: CreateNotifParams[] = [];
    for (const { user, community } of assignments) {
      await this.communityMembershipService.leaveOtherCommunitiesOnJoin(user);

      // Refetch community to get up-to-date users list
      const freshCommunity = await this.communityRepository.findOneOrFail({
        where: { id: community.id },
        relations: { users: true, leaders: true },
      });

      // Add user to new community
      await this.communityMembershipService.addUsersToCommunityAndRefreshConversation(
        {
          user,
          community: freshCommunity,
          groupJoinAudience: groupJoinAudiences.get(community.id),
          notifForLeader: ({ leader }) =>
            memberJoinedCommunityNotif({
              leader,
              joiner: user,
              community: freshCommunity,
              message: notifMessage`Alliance staff assigned ${member(user)} to your group (${group(freshCommunity)})`,
            }),
        },
      );

      userNotifs.push({
        user,
        category: NotificationCategory.CommunityAssigned,
        message: assignedToGroupMessage(freshCommunity),
        destination: communityDestination(freshCommunity.id),
        webAppLocation: groupUrl({
          communityId: freshCommunity.id,
        }),
        associatedUsers: [],
      });
    }

    await this.notifsService.sendNotifs(userNotifs);
  }
}

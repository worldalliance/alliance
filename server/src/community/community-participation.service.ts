import { acceptsPublicJoin } from "@alliance/common/community";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
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
import { User } from "src/user/entities/user.entity";
import { type Repository } from "typeorm";
import {
  CommunityMembershipService,
  ContractRefusalAudience,
} from "./community-membership.service";
import { CommunityService } from "./community.service";
import {
  memberJoinedCommunityNotif,
  memberLeftCommunityNotif,
} from "./community.utils";
import { Community, loadedCommunityUsers } from "./entities/community.entity";

@Injectable()
export class CommunityParticipationService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
    private readonly notifsService: NotifsService,
  ) {}

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
      this.communityService.findOneOrFail(communityId),
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
    const community = await this.communityService.findOneOrFail(communityId);
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
}

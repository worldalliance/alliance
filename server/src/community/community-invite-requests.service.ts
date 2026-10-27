import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  groupInviteMessage,
  groupInviteRequestApprovedMessage,
  groupInviteRequestMessage,
  groupInviteRequestRejectedMessage,
} from "src/notifs/notif-copy";
import { communityDestination } from "src/notifs/notification-content";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { groupUrl } from "src/search/approutes";
import { loadedUserCommunities, User } from "src/user/entities/user.entity";
import { IsNull, type Repository } from "typeorm";
import { assertCanManageCommunity } from "./community-permissions";
import { RequestCommunityInviteDto } from "./dto/community-invite.dto";
import {
  CommunityInvite,
  CommunityInviteStatus,
  loadedCommunityInviteCommunity,
  loadedCommunityInviteInvitedUser,
} from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";
import { saveInviteOfLiveParents, setLiveInviteStatus } from "./invite-writes";

@Injectable()
export class CommunityInviteRequestsService {
  constructor(
    @InjectRepository(CommunityInvite)
    private readonly communityInviteRepository: Repository<CommunityInvite>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notifsService: NotifsService,
  ) {}

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
              message: groupInviteRequestMessage({
                requester: invitingUser,
                invitee: invitedUser,
                community,
              }),
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
        message: groupInviteMessage(invite.invitingUser ?? user, community),
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
              category: NotificationCategory.CommunityInviteRequestApproved,
              message: groupInviteRequestApprovedMessage(invitedUser),
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
        message: groupInviteRequestRejectedMessage(invitedUser),
        destination: null,
        webAppLocation: groupUrl({
          tab: "groups",
        }),
        associatedUsers: [user],
        communityInvite: invite,
      });
    }
  }
}

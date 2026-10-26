import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  groupInviteAcceptedMessage,
  groupInviteDeclinedMessage,
  groupInviteMessage,
  memberJoinedYourGroupMessage,
} from "src/notifs/notif-copy";
import { communityDestination } from "src/notifs/notification-content";
import { NotificationInboxService } from "src/notifs/notification-inbox.service";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { groupUrl } from "src/search/approutes";
import { User } from "src/user/entities/user.entity";
import { IsNull, type Repository } from "typeorm";
import {
  CommunityMembershipService,
  ContractRefusalAudience,
} from "./community-membership.service";
import {
  assertCanManageCommunity,
  canManageCommunity,
} from "./community-permissions";
import { CommunityService } from "./community.service";
import { memberJoinedCommunityNotif } from "./community.utils";
import { CreateCommunityInviteDto } from "./dto/community-invite.dto";
import {
  CommunityInvite,
  CommunityInviteStatus,
  loadedCommunityInviteCommunity,
  loadedCommunityInviteInvitedUser,
} from "./entities/community-invite.entity";
import { loadedCommunityUsers } from "./entities/community.entity";
import { canModifyInvite } from "./invite-permissions";
import { saveInviteOfLiveParents, setLiveInviteStatus } from "./invite-writes";

@Injectable()
export class CommunityInvitesService {
  constructor(
    @InjectRepository(CommunityInvite)
    private readonly communityInviteRepository: Repository<CommunityInvite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
    private readonly notifsService: NotifsService,
    private readonly inbox: NotificationInboxService,
  ) {}

  async createCommunityInvite(
    body: CreateCommunityInviteDto,
    userId: number,
  ): Promise<CommunityInvite> {
    const { invitedUserId, communityId } = body;

    const invitedUser = await this.userRepository.findOneOrFail({
      where: { id: invitedUserId },
    });
    const community = await this.communityService.findOneOrFail(communityId);
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
      message: groupInviteMessage(invitingUser, community),
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
      !canModifyInvite(user, {
        invitingUserId: invite.invitingUser?.id ?? null,
        communityId: loadedCommunityInviteCommunity(invite).id,
      })
    ) {
      throw new BadRequestException();
    }
    await this.communityInviteRepository.update(inviteId, {
      deletedAt: new Date(),
    });
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

    const community = await this.communityService.findOneOrFail(
      loadedCommunityInviteCommunity(invite).id,
    );

    if (
      loadedCommunityUsers(community).some((user) => user.id === invitedUser.id)
    ) {
      throw new BadRequestException();
    }
    // Before any write, so a refused join leaves the invite and the
    // invitee's current groups untouched.
    await this.communityMembershipService.assertUsersHaveActiveContracts(
      [invitedUser],
      ContractRefusalAudience.Self,
    );

    invite.status = CommunityInviteStatus.InviteeAccepted;
    await setLiveInviteStatus(this.communityInviteRepository.manager, invite);
    await Promise.all([
      this.communityMembershipService.addUsersToCommunityAndRefreshConversation(
        {
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
              message: memberJoinedYourGroupMessage(invitedUser, community),
            });
          },
        },
      ),
      this.communityMembershipService.leaveOtherCommunitiesOnJoin(invitedUser),
      ...invite.notifs!.map((notif) => this.inbox.setRead(notif.id, userId)),
      this.notifsService.sendNotif({
        user: invite.invitingUser!,
        category: NotificationCategory.CommunityInviteAccepted,
        message: groupInviteAcceptedMessage(invitedUser, community),
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
      ...invite.notifs!.map((notif) => this.inbox.setRead(notif.id, userId)),
    ]);

    await this.notifsService.sendNotif({
      user: invite.invitingUser!,
      category: NotificationCategory.CommunityInviteRejected,
      message: groupInviteDeclinedMessage(invitedUser, community),
      destination: communityDestination(community.id),
      webAppLocation: groupUrl({
        tab: "invites",
        communityId: community.id,
      }),
      associatedUsers: [invitedUser],
      communityInvite: invite,
    });
  }
}

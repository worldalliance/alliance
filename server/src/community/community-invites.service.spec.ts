import { BadRequestException } from "@nestjs/common";
import { ImagesService } from "src/images/images.service";
import { NotificationInboxService } from "src/notifs/notification-inbox.service";
import { User } from "src/user/entities/user.entity";
import { CommunityInvitesService } from "./community-invites.service";
import {
  buildCommunity,
  leader1,
  mockCommunityServices,
  type CommunityServiceMocks,
} from "./community-services.fixtures";
import { CommunityService } from "./community.service";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "./entities/community-invite.entity";

describe("CommunityInvitesService", () => {
  let fx: CommunityServiceMocks;
  let invites: CommunityInvitesService;

  beforeEach(() => {
    fx = mockCommunityServices();
    invites = new CommunityInvitesService(
      fx.communityInviteRepository,
      fx.userRepository,
      new CommunityService(
        fx.communityRepository,
        fx.userRepository,
        fx.communityConversationService,
        {} as ImagesService,
        fx.notifsService,
        fx.groupJoinNotifsService,
        fx.membership,
      ),
      fx.membership,
      fx.notifsService,
      {} as NotificationInboxService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("acceptCommunityInvite", () => {
    it("leaves the invitee's other groups through leaveOtherCommunitiesOnJoin", async () => {
      const invitee = {
        id: 5,
        name: "Invited User",
        communities: [buildCommunity({ id: 2 })],
      } as User;
      fx.communityInviteRepository.findOneOrFail.mockResolvedValue(
        Object.assign(new CommunityInvite(), {
          id: 7,
          status: CommunityInviteStatus.InviteePending,
          invitedUser: invitee,
          invitingUser: leader1,
          community: buildCommunity(),
          notifs: [],
        }),
      );
      fx.communityRepository.findOneOrFail.mockResolvedValue(buildCommunity());
      const leave = jest
        .spyOn(fx.membership, "leaveOtherCommunitiesOnJoin")
        .mockResolvedValue();

      await invites.acceptCommunityInvite(7, invitee.id);

      expect(fx.inviteUpdates).toHaveBeenCalledWith(
        fx.communityInviteRepository.manager,
        expect.objectContaining({
          id: 7,
          status: CommunityInviteStatus.InviteeAccepted,
        }),
      );
      expect(leave).toHaveBeenCalledWith(invitee);
    });

    it("writes nothing when the invitee has no active contract", async () => {
      const invitee = {
        id: 5,
        name: "Unsigned User",
        communities: [buildCommunity({ id: 2, leaders: [] })],
      } as User;
      fx.communityInviteRepository.findOneOrFail.mockResolvedValue(
        Object.assign(new CommunityInvite(), {
          id: 7,
          status: CommunityInviteStatus.InviteePending,
          invitedUser: invitee,
          invitingUser: leader1,
          community: buildCommunity(),
          notifs: [],
        }),
      );
      fx.communityRepository.findOneOrFail.mockResolvedValue(buildCommunity());
      fx.signed.userIds = [];
      const join = jest.spyOn(
        fx.membership,
        "addUsersToCommunityAndRefreshConversation",
      );
      const leave = jest.spyOn(
        fx.membership,
        "removeUserFromCommunityAndRefreshConversation",
      );

      await expect(
        invites.acceptCommunityInvite(7, invitee.id),
      ).rejects.toThrow(BadRequestException);

      expect(fx.inviteUpdates).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
      expect(leave).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotif).not.toHaveBeenCalled();
    });
  });
});

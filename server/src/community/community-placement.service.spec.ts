import { Logger } from "@nestjs/common";
import { ImagesService } from "src/images/images.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { SegmentType } from "src/notifs/notification-content";
import { User } from "src/user/entities/user.entity";
import { IsNull } from "typeorm";
import { CommunityPlacementService } from "./community-placement.service";
import {
  buildCommunity,
  leader1,
  leader2,
  membershipWrite,
  mockCommunityServices,
  type CommunityServiceMocks,
} from "./community-services.fixtures";
import { CommunityService } from "./community.service";

describe("CommunityPlacementService", () => {
  let fx: CommunityServiceMocks;
  let placement: CommunityPlacementService;

  beforeEach(() => {
    fx = mockCommunityServices();
    placement = new CommunityPlacementService(
      fx.communityRepository,
      fx.userRepository,
      new CommunityService(
        fx.communityRepository,
        fx.userRepository,
        fx.communityConversationService,
        {} as ImagesService,
        fx.notifsService,
        fx.membership,
      ),
      fx.membership,
      fx.communityConversationService,
      fx.notifsService,
      fx.groupJoinNotifsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("moveUserBetweenCommunitiesAdmin", () => {
    const setUpMove = () => {
      const user = { id: 99, name: "Moving Member" } as User;
      const sourceCommunity = buildCommunity({
        id: 1,
        name: "Old Group",
        users: [leader1, user],
        leaders: [leader1],
      });
      const destinationCommunity = buildCommunity({
        id: 2,
        name: "New Group",
        users: [leader2],
        leaders: [leader2],
        allowStaffAssignments: true,
        maxCapacity: 10,
      });
      fx.communityRepository.findOneOrFail.mockImplementation(({ where }) => {
        const condition = Array.isArray(where) ? where[0] : where;
        return Promise.resolve(
          condition?.id === sourceCommunity.id
            ? sourceCommunity
            : destinationCommunity,
        );
      });
      fx.userRepository.findOneOrFail.mockResolvedValue(user);
      return { user, sourceCommunity, destinationCommunity };
    };

    const move = (params: ReturnType<typeof setUpMove>) =>
      placement.moveUserBetweenCommunitiesAdmin({
        sourceCommunityId: params.sourceCommunity.id,
        destinationCommunityId: params.destinationCommunity.id,
        userId: params.user.id,
      });

    it("writes both memberships in one transaction before side effects", async () => {
      const { user, sourceCommunity, destinationCommunity } = setUpMove();

      await move({ user, sourceCommunity, destinationCommunity });

      expect(fx.transaction).toHaveBeenCalledTimes(1);
      expect(fx.addAndRemove.mock.calls).toEqual([
        [
          membershipWrite({
            communityId: sourceCommunity.id,
            relation: "users",
            remove: [user.id],
          }),
        ],
        [
          membershipWrite({
            communityId: destinationCommunity.id,
            relation: "users",
            add: [user.id],
          }),
        ],
      ]);
      expect(fx.userRepository.update).toHaveBeenCalledWith(
        { id: user.id, deletedAt: IsNull() },
        { undergoingGroupAssignment: false, pendingCommunity: null },
      );
      expect(
        fx.communityConversationService.placeCommunityConversationParticipant,
      ).toHaveBeenCalledWith({
        manager: fx.transactionManager,
        user,
        sourceCommunity,
        destinationCommunity,
      });
      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledTimes(2);
      expect(fx.notifsService.sendNotifs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user,
            category: NotificationCategory.CommunityAssigned,
            message: {
              text: "Alliance staff moved you from Old Group to New Group",
              segments: [
                "Alliance staff moved you from ",
                { type: SegmentType.Community, id: sourceCommunity.id },
                " to ",
                { type: SegmentType.Community, id: destinationCommunity.id },
              ],
            },
          }),
        ]),
      );
    });

    it("does not announce a move when its membership write fails", async () => {
      const communities = setUpMove();
      fx.addAndRemove.mockRejectedValueOnce(new Error("db is down"));

      await expect(move(communities)).rejects.toThrow("db is down");

      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotifs).not.toHaveBeenCalled();
      expect(fx.groupJoinNotifsService.notify).not.toHaveBeenCalled();
    });

    it("announces the move to the destination's existing members, not its leaders", async () => {
      const communities = setUpMove();
      const existing = { id: 7, name: "Existing Member" } as User;
      communities.destinationCommunity.users!.push(existing);

      await move(communities);

      expect(fx.groupJoinNotifsService.notify).toHaveBeenCalledWith({
        community: communities.destinationCommunity,
        joiners: [communities.user],
        audience: [existing],
      });
    });

    it("does not commit the placement when participant authorization cannot be updated", async () => {
      const communities = setUpMove();
      fx.communityConversationService.placeCommunityConversationParticipant.mockRejectedValueOnce(
        new Error("participant write failed"),
      );

      await expect(move(communities)).rejects.toThrow(
        "participant write failed",
      );

      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("keeps the committed move successful when a follow-up effect fails", async () => {
      const communities = setUpMove();
      const syncError = new Error("conversation sync failed");
      fx.communityConversationService.syncCommunityConversationMembers.mockRejectedValueOnce(
        syncError,
      );
      const loggerError = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      await expect(move(communities)).resolves.toBeUndefined();

      expect(fx.notifsService.sendNotifs).toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalledWith(
        "Post-commit membership effect failed: sync community conversation 1",
        syncError,
      );
      loggerError.mockRestore();
    });
  });

  describe("addUserToCommunityAdmin", () => {
    it("locks and writes the assignment transactionally and notifies the member", async () => {
      const user = { id: 99, name: "New Member" } as User;
      const destinationCommunity = buildCommunity({
        id: 2,
        name: "New Group",
        users: [leader2],
        leaders: [leader2],
        allowStaffAssignments: true,
        maxCapacity: 10,
      });
      fx.communityRepository.findOneOrFail.mockResolvedValue(
        destinationCommunity,
      );
      fx.userRepository.findOneOrFail.mockResolvedValue(user);

      await placement.addUserToCommunityAdmin({
        communityId: destinationCommunity.id,
        userId: user.id,
      });

      expect(fx.transaction).toHaveBeenCalledTimes(1);
      expect(fx.addAndRemove).toHaveBeenCalledWith(
        membershipWrite({
          communityId: destinationCommunity.id,
          relation: "users",
          add: [user.id],
        }),
      );
      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(destinationCommunity.id);
      expect(fx.notifsService.sendNotifs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user,
            category: NotificationCategory.CommunityAssigned,
            message: expect.objectContaining({
              text: "Alliance staff assigned you to New Group",
            }),
          }),
        ]),
      );
    });
  });
});

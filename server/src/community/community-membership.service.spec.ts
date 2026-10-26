import { BadRequestException } from "@nestjs/common";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { notifMessage } from "src/notifs/notification-content";
import { type CreateNotifParams } from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import { In, IsNull } from "typeorm";
import { ContractRefusalAudience } from "./community-membership.service";
import {
  buildCommunity,
  leader1,
  leader2,
  membershipWrite,
  mockCommunityServices,
  type CommunityServiceMocks,
} from "./community-services.fixtures";
import { memberLeftCommunityNotif } from "./community.utils";

describe("CommunityMembershipService", () => {
  let fx: CommunityServiceMocks;

  beforeEach(() => {
    fx = mockCommunityServices();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addUsersToCommunityAndRefreshConversation", () => {
    it("throws when user is already a member", async () => {
      const user = { id: 5, name: "Existing User" } as User;
      const community = buildCommunity({ users: [user] });

      await expect(
        fx.membership.addUsersToCommunityAndRefreshConversation({
          user,
          community,
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(fx.addAndRemove).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("throws when the user has no active contract", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      const community = buildCommunity();
      fx.signed.userIds = [];

      await expect(
        fx.membership.addUsersToCommunityAndRefreshConversation({
          user,
          community,
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(fx.addAndRemove).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("names who is blocked for staff, rather than exposing ids", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      fx.signed.userIds = [];

      await expect(
        fx.membership.addUsersToCommunityAndRefreshConversation({
          user,
          community: buildCommunity(),
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(/Unsigned User/);
    });

    it("tells a member joining for themselves about their own contract", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      fx.signed.userIds = [];

      const rejection = fx.membership.addUsersToCommunityAndRefreshConversation(
        {
          user,
          community: buildCommunity(),
          contractRefusalAudience: ContractRefusalAudience.Self,
          notifForLeader: () => null,
        },
      );

      await expect(rejection).rejects.toThrow(
        "You need an active contract to join a group.",
      );
      // Nothing about the account behind the request.
      await expect(rejection).rejects.not.toThrow(/Unsigned User|\b5\b/);
    });

    it("skips the contract check while the contract is being signed", async () => {
      const user = { id: 5, name: "Signing User" } as User;
      const community = buildCommunity();

      await fx.membership.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        contractBeingSigned: true,
        notifForLeader: () => null,
      });

      expect(fx.userRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(fx.addAndRemove).toHaveBeenCalledWith(
        membershipWrite({
          communityId: community.id,
          relation: "users",
          add: [user.id],
        }),
      );
    });

    it("adds user to community, sends notifs, and syncs conversation", async () => {
      const user = { id: 5, name: "New User" } as User;
      const community = buildCommunity();

      const notifFactory = jest.fn(({ leader }: { leader: User }) => ({
        user: { id: leader.id },
        category: "test" as NotificationCategory,
        message: notifMessage`${user.name} joined`,
        destination: null,
        webAppLocation: "/community/1",
        associatedUsers: [],
      })) as (params: { leader: User }) => CreateNotifParams;

      await fx.membership.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: notifFactory,
      });

      expect(fx.addAndRemove).toHaveBeenCalledWith(
        membershipWrite({
          communityId: community.id,
          relation: "users",
          add: [user.id],
        }),
      );

      // clears user's pending state
      expect(fx.userRepository.update).toHaveBeenCalledWith(
        { id: In([user.id]), deletedAt: IsNull() },
        { undergoingGroupAssignment: false, pendingCommunity: null },
      );

      // sends one notif per leader
      expect(fx.notifsService.sendNotifs).toHaveBeenCalledTimes(1);
      const sentNotifs = fx.notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(2);

      // syncs conversation members
      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(community.id);
    });

    it("announces the join to the members it was loaded with, not its leaders", async () => {
      const user = { id: 5, name: "New User" } as User;
      const existing = { id: 7, name: "Existing Member" } as User;
      const community = buildCommunity({ users: [existing, leader1] });

      await fx.membership.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: () => null,
      });

      expect(fx.groupJoinNotifsService.notify).toHaveBeenCalledWith({
        community,
        joiners: [user],
        audience: [existing],
      });
    });

    it("announces the join to a supplied audience instead", async () => {
      const user = { id: 5, name: "New User" } as User;
      const existing = { id: 7, name: "Existing Member" } as User;
      const community = buildCommunity();

      await fx.membership.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: () => null,
        groupJoinAudience: [existing],
      });

      expect(fx.groupJoinNotifsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ audience: [existing] }),
      );
    });

    it("does not announce a join whose membership write fails", async () => {
      const user = { id: 5, name: "New User" } as User;
      fx.addAndRemove.mockRejectedValueOnce(new Error("db is down"));

      await expect(
        fx.membership.addUsersToCommunityAndRefreshConversation({
          user,
          community: buildCommunity(),
          notifForLeader: () => null,
        }),
      ).rejects.toThrow("db is down");

      expect(fx.groupJoinNotifsService.notify).not.toHaveBeenCalled();
    });

    it("filters out null notifs from the leader notif factory", async () => {
      const user = { id: 6, name: "Another User" } as User;
      const community = buildCommunity();

      // only produce a notif for leader1, return null for leader2
      const notifFactory = ({ leader }: { leader: User }) =>
        leader.id === leader1.id
          ? ({
              user: { id: leader.id },
              category: "test" as NotificationCategory,
              message: notifMessage`joined`,
              destination: null,
              webAppLocation: "/",
              associatedUsers: [],
            } as CreateNotifParams)
          : null;

      await fx.membership.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: notifFactory,
      });

      const sentNotifs = fx.notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(1);
    });
  });

  describe("leaveOtherCommunitiesOnJoin", () => {
    it("leaves the groups the user does not lead and notifies their leaders", async () => {
      const user = { id: 99, name: "Switching Member" } as User;
      const memberOf = buildCommunity({ id: 2, users: [leader1, user] });
      const leads = buildCommunity({ id: 3, users: [user], leaders: [user] });
      user.communities = [memberOf, leads];

      await fx.membership.leaveOtherCommunitiesOnJoin(user);

      expect(fx.addAndRemove.mock.calls).toEqual([
        [
          membershipWrite({
            communityId: memberOf.id,
            relation: "users",
            remove: [user.id],
          }),
        ],
      ]);
      expect(fx.notifsService.sendNotifs).toHaveBeenCalledWith(
        [leader1, leader2].map((leader) =>
          memberLeftCommunityNotif({
            leader,
            leaver: user,
            community: memberOf,
          }),
        ),
      );
    });
  });

  describe("removeUserFromCommunityAndRefreshConversation", () => {
    it("returns the community unchanged when user is not a member", async () => {
      const user = { id: 99, name: "Non-member" } as User;
      const community = buildCommunity({ users: [leader1, leader2] });

      const result =
        await fx.membership.removeUserFromCommunityAndRefreshConversation({
          user,
          community,
          removeAsLeader: false,
          notifForLeader: () => null,
          saveAsPendingCommunity: false,
        });

      expect(result).toBe(community);
      expect(fx.addAndRemove).not.toHaveBeenCalled();
      expect(fx.notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("removes user from members and leaders, sends notifs, and syncs conversation", async () => {
      const user = leader1;
      const community = buildCommunity({
        users: [leader1, leader2],
      });

      const notifFactory = jest.fn(({ leader }: { leader: User }) => ({
        user: { id: leader.id },
        category: "test" as NotificationCategory,
        message: notifMessage`${user.name} left`,
        destination: null,
        webAppLocation: "/community/1",
        associatedUsers: [],
      })) as (params: { leader: User }) => CreateNotifParams;

      await fx.membership.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: true,
        notifForLeader: notifFactory,
        saveAsPendingCommunity: false,
      });

      expect(fx.addAndRemove.mock.calls).toEqual([
        [
          membershipWrite({
            communityId: community.id,
            relation: "users",
            remove: [user.id],
          }),
        ],
        [
          membershipWrite({
            communityId: community.id,
            relation: "leaders",
            remove: [user.id],
          }),
        ],
      ]);

      // notifs sent only to remaining leaders (leader2)
      const sentNotifs = fx.notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(1);

      // syncs conversation
      expect(
        fx.communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(community.id);
    });

    it("removes a non-leader user from members while keeping leaders intact", async () => {
      const user = { id: 99, name: "Regular Member" } as User;
      const community = buildCommunity({
        users: [leader1, leader2, user],
      });

      await fx.membership.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: false,
      });

      expect(fx.addAndRemove.mock.calls).toEqual([
        [
          membershipWrite({
            communityId: community.id,
            relation: "users",
            remove: [user.id],
          }),
        ],
      ]);
    });

    it("saves user pendingCommunity when saveAsPendingCommunity is true", async () => {
      const user = { id: 99, name: "Departing Member" } as User;
      const community = buildCommunity({
        users: [leader1, user],
      });

      await fx.membership.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: true,
      });

      expect(fx.userRepository.update).toHaveBeenCalledWith(
        { id: In([user.id]), deletedAt: IsNull() },
        { pendingCommunity: { id: community.id } },
      );
    });

    it("does not save pendingCommunity when saveAsPendingCommunity is false", async () => {
      const user = { id: 99, name: "Departing Member" } as User;
      const community = buildCommunity({
        users: [leader1, user],
      });

      await fx.membership.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: false,
      });

      expect(fx.userRepository.update).not.toHaveBeenCalled();
    });
  });
});

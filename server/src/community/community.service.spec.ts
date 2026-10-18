import { BadRequestException, Logger } from "@nestjs/common";
import * as softDelete from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { notifMessage, SegmentType } from "src/notifs/notification-content";
import { NotificationInboxService } from "src/notifs/notification-inbox.service";
import {
  NotifsService,
  type CreateNotifParams,
} from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import { In, IsNull, type EntityManager, type Repository } from "typeorm";
import * as changeMembersModule from "./change-members";
import { CommunityService, ContractRefusalAudience } from "./community.service";
import { memberLeftCommunityNotif } from "./community.utils";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";
import { GroupJoinNotifsService } from "./group-join-notifs.service";
import * as inviteWritesModule from "./invite-writes";

describe("CommunityService", () => {
  let service: CommunityService;
  let communityInviteRepository: jest.Mocked<Repository<CommunityInvite>>;
  let communityRepository: jest.Mocked<Repository<Community>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let communityConversationService: jest.Mocked<CommunityConversationService>;
  let notifsService: jest.Mocked<NotifsService>;
  let groupJoinNotifsService: GroupJoinNotifsService;
  let transaction: jest.Mock;
  let transactionManager: EntityManager;
  let addAndRemove: jest.Mock;
  let inviteUpdates: jest.SpyInstance;

  const membershipWrite = (params: {
    communityId: number;
    relation: "users" | "leaders";
    add?: number[];
    remove?: number[];
  }) => ({ add: [], remove: [], ...params });

  const leader1 = { id: 10, name: "Leader One" } as User;
  const leader2 = { id: 11, name: "Leader Two" } as User;

  /** Ids the contract check should treat as signed; every id by default. */
  let signedUserIds: number[] | "all";

  const buildCommunity = (overrides?: Partial<Community>): Community =>
    ({
      id: 1,
      name: "Test Community",
      users: [],
      leaders: [leader1, leader2],
      ...overrides,
    }) as Community;

  beforeEach(() => {
    inviteUpdates = jest
      .spyOn(inviteWritesModule, "setLiveInviteStatus")
      .mockResolvedValue();
    communityInviteRepository = {
      findOneOrFail: jest.fn(),
      manager: {},
    } as unknown as jest.Mocked<Repository<CommunityInvite>>;

    transactionManager = {
      queryRunner: { isTransactionActive: true },
      getRepository: jest.fn((entity) =>
        entity === Community ? communityRepository : userRepository,
      ),
      update: jest.fn((_target, criteria, partial) =>
        userRepository.update(criteria, partial),
      ),
    } as unknown as EntityManager;
    addAndRemove = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(softDelete, "writeUnderLive")
      .mockImplementation((manager, { write }) =>
        manager.queryRunner?.isTransactionActive
          ? write(manager)
          : manager.transaction(write),
      );
    jest
      .spyOn(softDelete, "lockLiveIds")
      .mockImplementation(async (_manager, { ids }) => new Set(ids));
    jest
      .spyOn(changeMembersModule, "changeMembers")
      .mockImplementation(async ({ manager: _, ...write }) => {
        if (write.add?.length || write.remove?.length) {
          await addAndRemove(membershipWrite(write));
        }
        return write.add ?? [];
      });
    transaction = jest.fn(
      (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(transactionManager),
    );
    communityRepository = {
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve({ ...entity })),
      findOneOrFail: jest.fn(),
      manager: { transaction },
    } as unknown as jest.Mocked<Repository<Community>>;

    // The only query builder this service builds is the contract check, which
    // asks "which of these ids have signed" and reads back raw ids.
    signedUserIds = "all";
    let checkedIds: number[] = [];
    const contractCheck = {
      select: jest.fn(() => contractCheck),
      where: jest.fn((_condition: string, params: { userIds: number[] }) => {
        checkedIds = params.userIds;
        return contractCheck;
      }),
      andWhere: jest.fn(() => contractCheck),
      getRawMany: jest.fn(() =>
        Promise.resolve(
          checkedIds
            .filter(
              (id) => signedUserIds === "all" || signedUserIds.includes(id),
            )
            .map((id) => ({ id })),
        ),
      ),
    };

    userRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn(() => contractCheck),
    } as unknown as jest.Mocked<Repository<User>>;
    communityConversationService = {
      placeCommunityConversationParticipant: jest
        .fn()
        .mockResolvedValue(undefined),
      syncCommunityConversationMembers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CommunityConversationService>;

    notifsService = {
      sendNotif: jest.fn().mockResolvedValue(undefined),
      sendNotifs: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<NotifsService>;

    groupJoinNotifsService = new GroupJoinNotifsService(
      {} as NotifsService,
      {} as MmsService,
      {} as NotificationPreferencesService,
    );
    jest.spyOn(groupJoinNotifsService, "notify").mockResolvedValue();

    service = new CommunityService(
      communityInviteRepository,
      communityRepository,
      userRepository,
      communityConversationService,
      {} as ImagesService,
      notifsService,
      groupJoinNotifsService,
      {} as NotificationInboxService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addUsersToCommunityAndRefreshConversation", () => {
    it("throws when user is already a member", async () => {
      const user = { id: 5, name: "Existing User" } as User;
      const community = buildCommunity({ users: [user] });

      await expect(
        service.addUsersToCommunityAndRefreshConversation({
          user,
          community,
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(addAndRemove).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("throws when the user has no active contract", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      const community = buildCommunity();
      signedUserIds = [];

      await expect(
        service.addUsersToCommunityAndRefreshConversation({
          user,
          community,
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(addAndRemove).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("names who is blocked for staff, rather than exposing ids", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      signedUserIds = [];

      await expect(
        service.addUsersToCommunityAndRefreshConversation({
          user,
          community: buildCommunity(),
          notifForLeader: () => null,
        }),
      ).rejects.toThrow(/Unsigned User/);
    });

    it("tells a member joining for themselves about their own contract", async () => {
      const user = { id: 5, name: "Unsigned User" } as User;
      signedUserIds = [];

      const rejection = service.addUsersToCommunityAndRefreshConversation({
        user,
        community: buildCommunity(),
        contractRefusalAudience: ContractRefusalAudience.Self,
        notifForLeader: () => null,
      });

      await expect(rejection).rejects.toThrow(
        "You need an active contract to join a group.",
      );
      // Nothing about the account behind the request.
      await expect(rejection).rejects.not.toThrow(/Unsigned User|\b5\b/);
    });

    it("skips the contract check while the contract is being signed", async () => {
      const user = { id: 5, name: "Signing User" } as User;
      const community = buildCommunity();

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        contractBeingSigned: true,
        notifForLeader: () => null,
      });

      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(addAndRemove).toHaveBeenCalledWith(
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

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: notifFactory,
      });

      expect(addAndRemove).toHaveBeenCalledWith(
        membershipWrite({
          communityId: community.id,
          relation: "users",
          add: [user.id],
        }),
      );

      // clears user's pending state
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: In([user.id]), deletedAt: IsNull() },
        { undergoingGroupAssignment: false, pendingCommunity: null },
      );

      // sends one notif per leader
      expect(notifsService.sendNotifs).toHaveBeenCalledTimes(1);
      const sentNotifs = notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(2);

      // syncs conversation members
      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(community.id);
    });

    it("announces the join to the members it was loaded with, not its leaders", async () => {
      const user = { id: 5, name: "New User" } as User;
      const existing = { id: 7, name: "Existing Member" } as User;
      const community = buildCommunity({ users: [existing, leader1] });

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: () => null,
      });

      expect(groupJoinNotifsService.notify).toHaveBeenCalledWith({
        community,
        joiners: [user],
        audience: [existing],
      });
    });

    it("announces the join to a supplied audience instead", async () => {
      const user = { id: 5, name: "New User" } as User;
      const existing = { id: 7, name: "Existing Member" } as User;
      const community = buildCommunity();

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: () => null,
        groupJoinAudience: [existing],
      });

      expect(groupJoinNotifsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ audience: [existing] }),
      );
    });

    it("does not announce a join whose membership write fails", async () => {
      const user = { id: 5, name: "New User" } as User;
      addAndRemove.mockRejectedValueOnce(new Error("db is down"));

      await expect(
        service.addUsersToCommunityAndRefreshConversation({
          user,
          community: buildCommunity(),
          notifForLeader: () => null,
        }),
      ).rejects.toThrow("db is down");

      expect(groupJoinNotifsService.notify).not.toHaveBeenCalled();
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

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: notifFactory,
      });

      const sentNotifs = notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(1);
    });
  });

  describe("acceptCommunityInvite", () => {
    it("leaves the invitee's other groups through leaveOtherCommunitiesOnJoin", async () => {
      const invitee = {
        id: 5,
        name: "Invited User",
        communities: [buildCommunity({ id: 2 })],
      } as User;
      communityInviteRepository.findOneOrFail.mockResolvedValue(
        Object.assign(new CommunityInvite(), {
          id: 7,
          status: CommunityInviteStatus.InviteePending,
          invitedUser: invitee,
          invitingUser: leader1,
          community: buildCommunity(),
          notifs: [],
        }),
      );
      communityRepository.findOneOrFail.mockResolvedValue(buildCommunity());
      const leave = jest
        .spyOn(service, "leaveOtherCommunitiesOnJoin")
        .mockResolvedValue();

      await service.acceptCommunityInvite(7, invitee.id);

      expect(inviteUpdates).toHaveBeenCalledWith(
        communityInviteRepository.manager,
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
      communityInviteRepository.findOneOrFail.mockResolvedValue(
        Object.assign(new CommunityInvite(), {
          id: 7,
          status: CommunityInviteStatus.InviteePending,
          invitedUser: invitee,
          invitingUser: leader1,
          community: buildCommunity(),
          notifs: [],
        }),
      );
      communityRepository.findOneOrFail.mockResolvedValue(buildCommunity());
      signedUserIds = [];
      const join = jest.spyOn(
        service,
        "addUsersToCommunityAndRefreshConversation",
      );
      const leave = jest.spyOn(
        service,
        "removeUserFromCommunityAndRefreshConversation",
      );

      await expect(
        service.acceptCommunityInvite(7, invitee.id),
      ).rejects.toThrow(BadRequestException);

      expect(inviteUpdates).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
      expect(leave).not.toHaveBeenCalled();
      expect(notifsService.sendNotif).not.toHaveBeenCalled();
    });
  });

  describe("leaveOtherCommunitiesOnJoin", () => {
    it("leaves the groups the user does not lead and notifies their leaders", async () => {
      const user = { id: 99, name: "Switching Member" } as User;
      const memberOf = buildCommunity({ id: 2, users: [leader1, user] });
      const leads = buildCommunity({ id: 3, users: [user], leaders: [user] });
      user.communities = [memberOf, leads];

      await service.leaveOtherCommunitiesOnJoin(user);

      expect(addAndRemove.mock.calls).toEqual([
        [
          membershipWrite({
            communityId: memberOf.id,
            relation: "users",
            remove: [user.id],
          }),
        ],
      ]);
      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
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

  describe("leaveCommunity", () => {
    it("tells the group's leaders the member left", async () => {
      const user = { id: 99, name: "Departing Member" } as User;
      const community = buildCommunity({ users: [leader1, leader2, user] });
      communityRepository.findOneOrFail.mockResolvedValue(community);

      await service.leaveCommunity(community.id, user.id);

      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
        [leader1, leader2].map((leader) =>
          memberLeftCommunityNotif({ leader, leaver: user, community }),
        ),
      );
    });
  });

  describe("joinPublicCommunity", () => {
    it("leaves the joiner's other groups through leaveOtherCommunitiesOnJoin", async () => {
      const user = {
        id: 99,
        name: "Public Joiner",
        communities: [buildCommunity({ id: 3 })],
      } as User;
      communityRepository.findOneOrFail.mockResolvedValue(
        buildCommunity({ public: true, maxCapacity: 10, users: [leader1] }),
      );
      userRepository.findOneOrFail.mockResolvedValue(user);
      const leave = jest
        .spyOn(service, "leaveOtherCommunitiesOnJoin")
        .mockResolvedValue();

      await service.joinPublicCommunity(user.id, 1);

      expect(leave).toHaveBeenCalledWith(user);
    });
  });

  describe("removeUserFromCommunityAndRefreshConversation", () => {
    it("returns the community unchanged when user is not a member", async () => {
      const user = { id: 99, name: "Non-member" } as User;
      const community = buildCommunity({ users: [leader1, leader2] });

      const result =
        await service.removeUserFromCommunityAndRefreshConversation({
          user,
          community,
          removeAsLeader: false,
          notifForLeader: () => null,
          saveAsPendingCommunity: false,
        });

      expect(result).toBe(community);
      expect(addAndRemove).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
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

      await service.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: true,
        notifForLeader: notifFactory,
        saveAsPendingCommunity: false,
      });

      expect(addAndRemove.mock.calls).toEqual([
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
      const sentNotifs = notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(1);

      // syncs conversation
      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(community.id);
    });

    it("removes a non-leader user from members while keeping leaders intact", async () => {
      const user = { id: 99, name: "Regular Member" } as User;
      const community = buildCommunity({
        users: [leader1, leader2, user],
      });

      await service.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: false,
      });

      expect(addAndRemove.mock.calls).toEqual([
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

      await service.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: true,
      });

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: In([user.id]), deletedAt: IsNull() },
        { pendingCommunity: { id: community.id } },
      );
    });

    it("does not save pendingCommunity when saveAsPendingCommunity is false", async () => {
      const user = { id: 99, name: "Departing Member" } as User;
      const community = buildCommunity({
        users: [leader1, user],
      });

      await service.removeUserFromCommunityAndRefreshConversation({
        user,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: false,
      });

      expect(userRepository.update).not.toHaveBeenCalled();
    });
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
      communityRepository.findOneOrFail.mockImplementation(({ where }) => {
        const condition = Array.isArray(where) ? where[0] : where;
        return Promise.resolve(
          condition?.id === sourceCommunity.id
            ? sourceCommunity
            : destinationCommunity,
        );
      });
      userRepository.findOneOrFail.mockResolvedValue(user);
      return { user, sourceCommunity, destinationCommunity };
    };

    const move = (params: ReturnType<typeof setUpMove>) =>
      service.moveUserBetweenCommunitiesAdmin({
        sourceCommunityId: params.sourceCommunity.id,
        destinationCommunityId: params.destinationCommunity.id,
        userId: params.user.id,
      });

    it("writes both memberships in one transaction before side effects", async () => {
      const { user, sourceCommunity, destinationCommunity } = setUpMove();

      await move({ user, sourceCommunity, destinationCommunity });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(addAndRemove.mock.calls).toEqual([
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
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: user.id, deletedAt: IsNull() },
        { undergoingGroupAssignment: false, pendingCommunity: null },
      );
      expect(
        communityConversationService.placeCommunityConversationParticipant,
      ).toHaveBeenCalledWith({
        manager: transactionManager,
        user,
        sourceCommunity,
        destinationCommunity,
      });
      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledTimes(2);
      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
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
      addAndRemove.mockRejectedValueOnce(new Error("db is down"));

      await expect(move(communities)).rejects.toThrow("db is down");

      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
      expect(groupJoinNotifsService.notify).not.toHaveBeenCalled();
    });

    it("announces the move to the destination's existing members, not its leaders", async () => {
      const communities = setUpMove();
      const existing = { id: 7, name: "Existing Member" } as User;
      communities.destinationCommunity.users!.push(existing);

      await move(communities);

      expect(groupJoinNotifsService.notify).toHaveBeenCalledWith({
        community: communities.destinationCommunity,
        joiners: [communities.user],
        audience: [existing],
      });
    });

    it("does not commit the placement when participant authorization cannot be updated", async () => {
      const communities = setUpMove();
      communityConversationService.placeCommunityConversationParticipant.mockRejectedValueOnce(
        new Error("participant write failed"),
      );

      await expect(move(communities)).rejects.toThrow(
        "participant write failed",
      );

      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("keeps the committed move successful when a follow-up effect fails", async () => {
      const communities = setUpMove();
      const syncError = new Error("conversation sync failed");
      communityConversationService.syncCommunityConversationMembers.mockRejectedValueOnce(
        syncError,
      );
      const loggerError = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      await expect(move(communities)).resolves.toBeUndefined();

      expect(notifsService.sendNotifs).toHaveBeenCalled();
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
      communityRepository.findOneOrFail.mockResolvedValue(destinationCommunity);
      userRepository.findOneOrFail.mockResolvedValue(user);

      await service.addUserToCommunityAdmin({
        communityId: destinationCommunity.id,
        userId: user.id,
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(addAndRemove).toHaveBeenCalledWith(
        membershipWrite({
          communityId: destinationCommunity.id,
          relation: "users",
          add: [user.id],
        }),
      );
      expect(
        communityConversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(destinationCommunity.id);
      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
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

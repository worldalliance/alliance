import { BadRequestException, Logger } from "@nestjs/common";
import { ImagesService } from "src/images/images.service";
import { ConversationService } from "src/messaging/conversation.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  NotifsService,
  type CreateNotifParams,
} from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import type { EntityManager, Repository } from "typeorm";
import { CommunityService, ContractRefusalAudience } from "./community.service";
import { CommunityInvite } from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";

describe("CommunityService", () => {
  let service: CommunityService;
  let communityInviteRepository: jest.Mocked<Repository<CommunityInvite>>;
  let communityRepository: jest.Mocked<Repository<Community>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let conversationService: jest.Mocked<ConversationService>;
  let notifsService: jest.Mocked<NotifsService>;
  let transaction: jest.Mock;
  let transactionManager: EntityManager;

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
    communityInviteRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Repository<CommunityInvite>>;

    transactionManager = {
      getRepository: jest.fn((entity) =>
        entity === Community ? communityRepository : userRepository,
      ),
    } as unknown as EntityManager;
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
      save: jest.fn().mockResolvedValue(undefined),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn(() => contractCheck),
    } as unknown as jest.Mocked<Repository<User>>;
    conversationService = {
      placeCommunityConversationParticipant: jest
        .fn()
        .mockResolvedValue(undefined),
      syncCommunityConversationMembers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConversationService>;

    notifsService = {
      sendNotif: jest.fn().mockResolvedValue(undefined),
      sendNotifs: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<NotifsService>;

    service = new CommunityService(
      communityInviteRepository,
      communityRepository,
      userRepository,
      conversationService,
      {} as ImagesService,
      notifsService,
    );
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

      expect(communityRepository.save).not.toHaveBeenCalled();
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

      expect(communityRepository.save).not.toHaveBeenCalled();
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
      expect(communityRepository.save).toHaveBeenCalledWith({
        id: community.id,
        users: [user],
      });
    });

    it("adds user to community, sends notifs, and syncs conversation", async () => {
      const user = { id: 5, name: "New User" } as User;
      const community = buildCommunity();

      const notifFactory = jest.fn(({ leader }: { leader: User }) => ({
        user: { id: leader.id },
        category: "test" as NotificationCategory,
        message: `${user.name} joined`,
        webAppLocation: "/community/1",
        associatedUsers: [],
      })) as (params: { leader: User }) => CreateNotifParams;

      await service.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: notifFactory,
      });

      // saves the community with the new user appended
      expect(communityRepository.save).toHaveBeenCalledWith({
        id: community.id,
        users: [user],
      });

      // clears user's pending state
      expect(userRepository.save).toHaveBeenCalledWith([
        {
          id: user.id,
          undergoingGroupAssignment: false,
          pendingCommunity: null,
        },
      ]);

      // sends one notif per leader
      expect(notifsService.sendNotifs).toHaveBeenCalledTimes(1);
      const sentNotifs = notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(2);

      // syncs conversation members
      expect(
        conversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(community.id);
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
              message: "joined",
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
      expect(communityRepository.save).not.toHaveBeenCalled();
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
        message: `${user.name} left`,
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

      // saves community with user removed from both members and leaders
      expect(communityRepository.save).toHaveBeenCalledWith({
        id: community.id,
        users: [leader2],
        leaders: [leader2],
      });

      // notifs sent only to remaining leaders (leader2)
      const sentNotifs = notifsService.sendNotifs.mock.calls[0][0];
      expect(sentNotifs).toHaveLength(1);

      // syncs conversation
      expect(
        conversationService.syncCommunityConversationMembers,
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

      expect(communityRepository.save).toHaveBeenCalledWith({
        id: community.id,
        users: [leader1, leader2],
        leaders: [leader1, leader2],
      });
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

      expect(userRepository.save).toHaveBeenCalledWith([
        {
          id: user.id,
          pendingCommunity: { id: community.id },
        },
      ]);
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

      expect(userRepository.save).not.toHaveBeenCalled();
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
      expect(communityRepository.save).toHaveBeenCalledWith([
        { id: sourceCommunity.id, users: [leader1] },
        { id: destinationCommunity.id, users: [leader2, user] },
      ]);
      expect(userRepository.save).toHaveBeenCalledWith({
        id: user.id,
        undergoingGroupAssignment: false,
        pendingCommunity: null,
      });
      expect(
        conversationService.placeCommunityConversationParticipant,
      ).toHaveBeenCalledWith({
        manager: transactionManager,
        user,
        sourceCommunity,
        destinationCommunity,
      });
      expect(
        conversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledTimes(2);
      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user,
            category: NotificationCategory.CommunityAssigned,
            message: "Alliance staff moved you from Old Group to New Group",
          }),
        ]),
      );
    });

    it("does not announce a move when its membership write fails", async () => {
      const communities = setUpMove();
      communityRepository.save.mockRejectedValueOnce(new Error("db is down"));

      await expect(move(communities)).rejects.toThrow("db is down");

      expect(
        conversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("does not commit the placement when participant authorization cannot be updated", async () => {
      const communities = setUpMove();
      conversationService.placeCommunityConversationParticipant.mockRejectedValueOnce(
        new Error("participant write failed"),
      );

      await expect(move(communities)).rejects.toThrow(
        "participant write failed",
      );

      expect(
        conversationService.syncCommunityConversationMembers,
      ).not.toHaveBeenCalled();
      expect(notifsService.sendNotifs).not.toHaveBeenCalled();
    });

    it("keeps the committed move successful when a follow-up effect fails", async () => {
      const communities = setUpMove();
      const syncError = new Error("conversation sync failed");
      conversationService.syncCommunityConversationMembers.mockRejectedValueOnce(
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
      expect(communityRepository.save).toHaveBeenCalledWith([
        { id: destinationCommunity.id, users: [leader2, user] },
      ]);
      expect(
        conversationService.syncCommunityConversationMembers,
      ).toHaveBeenCalledWith(destinationCommunity.id);
      expect(notifsService.sendNotifs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user,
            category: NotificationCategory.CommunityAssigned,
            message: "Alliance staff assigned you to New Group",
          }),
        ]),
      );
    });
  });
});

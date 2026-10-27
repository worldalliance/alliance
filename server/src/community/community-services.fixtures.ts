import * as softDelete from "src/datasources/soft-delete";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import { MmsService } from "src/mms/mms.service";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { NotifsService } from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import type { EntityManager, Repository } from "typeorm";
import * as changeMembersModule from "./change-members";
import { CommunityMembershipService } from "./community-membership.service";
import { CommunityInvite } from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";
import { GroupJoinNotifsService } from "./group-join-notifs.service";
import * as inviteWritesModule from "./invite-writes";

export const membershipWrite = (params: {
  communityId: number;
  relation: "users" | "leaders";
  add?: number[];
  remove?: number[];
}) => ({ add: [], remove: [], ...params });

export const leader1 = { id: 10, name: "Leader One" } as User;
export const leader2 = { id: 11, name: "Leader Two" } as User;

export const buildCommunity = (overrides?: Partial<Community>): Community =>
  ({
    id: 1,
    name: "Test Community",
    users: [],
    leaders: [leader1, leader2],
    ...overrides,
  }) as Community;

export type CommunityServiceMocks = ReturnType<typeof mockCommunityServices>;

/**
 * Mocks the repositories and collaborators the community services share, and
 * spies on the write helpers; call it in `beforeEach` and restore with
 * `jest.restoreAllMocks()`.
 */
export function mockCommunityServices() {
  const inviteUpdates = jest
    .spyOn(inviteWritesModule, "setLiveInviteStatus")
    .mockResolvedValue();
  const communityInviteRepository = {
    findOneOrFail: jest.fn(),
    manager: {},
  } as unknown as jest.Mocked<Repository<CommunityInvite>>;

  const transactionManager = {
    queryRunner: { isTransactionActive: true },
    getRepository: jest.fn((entity) =>
      entity === Community ? communityRepository : userRepository,
    ),
    update: jest.fn((_target, criteria, partial) =>
      userRepository.update(criteria, partial),
    ),
  } as unknown as EntityManager;
  const addAndRemove = jest.fn().mockResolvedValue(undefined);
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
  const transaction = jest.fn(
    (callback: (manager: EntityManager) => Promise<unknown>) =>
      callback(transactionManager),
  );
  const communityRepository = {
    save: jest
      .fn()
      .mockImplementation((entity) => Promise.resolve({ ...entity })),
    findOneOrFail: jest.fn(),
    manager: { transaction },
  } as unknown as jest.Mocked<Repository<Community>>;

  /** Ids the contract check should treat as signed; every id by default. */
  const signed: { userIds: number[] | "all" } = { userIds: "all" };
  // The only query builder these services build is the contract check, which
  // asks "which of these ids have signed" and reads back raw ids.
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
            (id) => signed.userIds === "all" || signed.userIds.includes(id),
          )
          .map((id) => ({ id })),
      ),
    ),
  };

  const userRepository = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneOrFail: jest.fn(),
    createQueryBuilder: jest.fn(() => contractCheck),
  } as unknown as jest.Mocked<Repository<User>>;
  const communityConversationService = {
    placeCommunityConversationParticipant: jest
      .fn()
      .mockResolvedValue(undefined),
    syncCommunityConversationMembers: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CommunityConversationService>;

  const notifsService = {
    sendNotif: jest.fn().mockResolvedValue(undefined),
    sendNotifs: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<NotifsService>;

  const groupJoinNotifsService = new GroupJoinNotifsService(
    {} as NotifsService,
    {} as MmsService,
    {} as NotificationPreferencesService,
  );
  jest.spyOn(groupJoinNotifsService, "notify").mockResolvedValue();

  return {
    signed,
    inviteUpdates,
    communityInviteRepository,
    communityRepository,
    userRepository,
    communityConversationService,
    notifsService,
    groupJoinNotifsService,
    transaction,
    transactionManager,
    addAndRemove,
    membership: new CommunityMembershipService(
      communityRepository,
      userRepository,
      communityConversationService,
      notifsService,
      groupJoinNotifsService,
    ),
  };
}

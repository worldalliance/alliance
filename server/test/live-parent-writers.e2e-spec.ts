import { ConversationType } from "@alliance/common/conversationType";
import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { ParticipantRole } from "@alliance/common/participantRole";
import { R } from "@alliance/common/result";
import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthService } from "src/auth/auth.service";
import { Guest } from "src/auth/entities/guest.entity";
import { OAuthAccount } from "src/auth/oauth/oauth-account.entity";
import { OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import { CommunityService } from "src/community/community.service";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import { lockLiveIds } from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { ConversationService } from "src/messaging/conversation.service";
import { Conversation } from "src/messaging/entities/conversation.entity";
import { Message } from "src/messaging/entities/message.entity";
import {
  Participant,
  ParticipantState,
} from "src/messaging/entities/participant.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { Push } from "src/push/push.entity";
import { PushService } from "src/push/push.service";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { AwayRangeEditor } from "src/user/away-range-history";
import { AmbassadorProgramMember } from "src/user/entities/ambassador-program-member.entity";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { Tag } from "src/user/entities/tag.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "src/user/entities/user-away-range.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import type { Repository } from "typeorm";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
  waitForLockWait,
  writeDuringDeletion,
} from "./e2e-test-utils";

describe("Writers beside a deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let userService: UserService;
  let emails = 0;

  const member = (overrides: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        name: "Writer Member",
        email: `writer-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );

  /** Soft-deletes `deleted` right after the next account load. */
  const deleteAfterUserLoad = (deleted: User) => {
    const findOneOrFail = userService.findOneOrFail.bind(userService);
    jest
      .spyOn(userService, "findOneOrFail")
      .mockImplementationOnce(async (id, relations) => {
        const loaded = await findOneOrFail(id, relations);
        await userRepo.softDelete(deleted.id);
        return loaded;
      });
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    userService = ctx.app.get(UserService);
  }, 50000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("locks more ids than a statement takes parameters", async () => {
    const live = await member();
    const ids = [live.id, ...Array.from({ length: 70_000 }, (_, i) => -1 - i)];

    const locked = await ctx.dataSource.transaction((manager) =>
      lockLiveIds(manager, { target: User, ids }),
    );

    expect([...locked]).toEqual([live.id]);
  });

  it("finds a live uuid row named in uppercase", async () => {
    const id = ctx.defaultTag.id.toUpperCase();

    const locked = await ctx.dataSource.transaction((manager) =>
      lockLiveIds(manager, { target: Tag, ids: [id] }),
    );

    expect([...locked]).toEqual([id]);
  });

  it("leaves a guest unlinked from a deleted account", async () => {
    const user = await member();
    const { guestId } = await ctx.app.get(AuthService).createGuestSession();
    await userRepo.softDelete(user.id);

    await ctx.app.get(AuthService).mergeGuestIntoUser(guestId, user.id);

    const guest = await ctx.dataSource
      .getRepository(Guest)
      .findOneOrFail({ where: { id: guestId }, loadRelationIds: true });
    expect(guest.linkedUser).toBeNull();
  });

  it("refuses an away range for an account deleted after it loads", async () => {
    const user = await member();
    deleteAfterUserLoad(user);

    await expect(
      userService.createAwayRange({
        userId: user.id,
        data: {
          reason: UserAwayRangeReason.VACATION,
          startDay: "2099-01-01",
          endDay: "2099-01-07",
        },
        editor: AwayRangeEditor.Admin,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource
        .getRepository(UserAwayRange)
        .find({ where: { userId: user.id }, withDeleted: true }),
    ).toEqual([]);
  });

  describe("an away range deleted after an edit loads it", () => {
    const deleteRangeAfterLoad = async (startDate: Date) => {
      const user = await member();
      const ranges = ctx.dataSource.getRepository(UserAwayRange);
      const range = await ranges.save({
        userId: user.id,
        startDate,
        endDate: new Date(Date.now() + 7 * 86_400_000),
        reason: UserAwayRangeReason.VACATION,
      });
      const repo = ctx.app.get<Repository<UserAwayRange>>(
        getRepositoryToken(UserAwayRange),
      );
      const findOne = repo.findOne.bind(repo);
      jest.spyOn(repo, "findOne").mockImplementationOnce(async (options) => {
        const loaded = await findOne(options);
        await ranges.softDelete(range.id);
        return loaded;
      });
      return { user, range, ranges };
    };

    it("stays deleted through an edit", async () => {
      const { user, range, ranges } = await deleteRangeAfterLoad(
        new Date(Date.now() + 86_400_000),
      );

      await expect(
        userService.updateAwayRange({
          userId: user.id,
          awayRangeId: range.id,
          data: { reason: UserAwayRangeReason.OTHER, note: "Edited" },
          editor: AwayRangeEditor.Admin,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(
        await ranges.findOneOrFail({
          where: { id: range.id },
          withDeleted: true,
        }),
      ).toMatchObject({ deletedAt: expect.any(Date) });
    });

    it("stays deleted when a member ends it early", async () => {
      const { user, range, ranges } = await deleteRangeAfterLoad(
        new Date(Date.now() - 86_400_000),
      );

      await expect(
        userService.deleteAwayRange({
          userId: user.id,
          awayRangeId: range.id,
          editor: AwayRangeEditor.Member,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(
        await ranges.findOneOrFail({
          where: { id: range.id },
          withDeleted: true,
        }),
      ).toMatchObject({ deletedAt: expect.any(Date) });
    });
  });

  it("refuses a one-time invite from an inviter deleted after it loads", async () => {
    const inviter = await member();
    deleteAfterUserLoad(inviter);

    await expect(
      userService.createOnetimeInvite(
        { invitee: "Invitee", invitingUserId: inviter.id },
        ctx.adminUserId,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(OnetimeInvite).find({
        where: { invitingUser: { id: inviter.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("leaves a group chat deleted while its info is edited", async () => {
    const admin = await member();
    const conversations = ctx.dataSource.getRepository(Conversation);
    const conversation = await conversations.save({
      type: ConversationType.Multiple,
      title: "Before",
    });
    await ctx.dataSource.getRepository(Participant).save({
      conversation,
      user: admin,
      role: ParticipantRole.Admin,
      state: ParticipantState.Joined,
      joinedAt: new Date(),
    });
    jest
      .spyOn(ctx.app.get(ImagesService), "processAndUploadProfileImage")
      .mockImplementationOnce(async () => {
        await conversations.softDelete(conversation.id);
        return "chat-photo-key";
      });

    await expect(
      ctx.app
        .get(ConversationService)
        .updateConversation(conversation.id, admin.id, {
          title: "After",
          photo: "data:image/png;base64,AAAA",
        }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await conversations.findOneOrFail({
        where: { id: conversation.id },
        withDeleted: true,
      }),
    ).toMatchObject({ title: "Before", deletedAt: expect.any(Date) });
  });

  it("founds no group for an account deleted after it loads", async () => {
    const founder = await member();
    const images = ctx.app.get(ImagesService);
    const resolvePhotoUpdate = images.resolvePhotoUpdate.bind(images);
    jest
      .spyOn(images, "resolvePhotoUpdate")
      .mockImplementationOnce(async (photo) => {
        await userRepo.softDelete(founder.id);
        return resolvePhotoUpdate(photo);
      });

    await expect(
      ctx.app.get(CommunityService).createCommunity(founder.id, {
        name: "Orphaned group",
        description: "Founded by a deleted account",
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(Community).count({
        where: { name: "Orphaned group" },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("registers no device for an account deleted after it loads", async () => {
    const user = await member();
    deleteAfterUserLoad(user);

    await expect(
      userService.registerDevice(user.id, {
        deviceType: "ios",
        expoPushToken: `ExponentPushToken[writer-${user.id}]`,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(UserDevice).find({
        where: { user: { id: user.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("registers a new device when the one holding the token goes before the reassignment", async () => {
    const previous = await member();
    const next = await member();
    const devices = ctx.dataSource.getRepository(UserDevice);
    const expoPushToken = `ExponentPushToken[reassigned-${previous.id}]`;
    const device = await devices.save({ user: previous, expoPushToken });
    const repo = ctx.app.get<Repository<UserDevice>>(
      getRepositoryToken(UserDevice),
    );
    const findOne = repo.findOne.bind(repo);
    jest.spyOn(repo, "findOne").mockImplementationOnce(async (options) => {
      const loaded = await findOne(options);
      await devices.delete(device.id);
      return loaded;
    });

    const registered = await userService.registerDevice(next.id, {
      deviceType: "ios",
      expoPushToken,
    });

    expect(registered).not.toBe(device.id);
    expect(
      await devices.findOneOrFail({
        where: { id: registered },
        relations: { user: true },
      }),
    ).toMatchObject({ expoPushToken, user: { id: next.id } });
  });

  it("enrolls no account deleted after it loads in the ambassador program", async () => {
    const user = await member();
    deleteAfterUserLoad(user);

    await expect(
      userService.upsertAmbassadorProgramMember({
        userId: user.id,
        invited: true,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(AmbassadorProgramMember).find({
        where: { user: { id: user.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("keeps a group's pending placement off a deleted account", async () => {
    const [leader, removed] = await Promise.all([member(), member()]);
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Pending group",
      description: "Pending",
      leaders: [leader],
      users: [leader, removed],
    });
    await userRepo.softDelete(removed.id);

    await ctx.app
      .get(CommunityService)
      .removeUserFromCommunityAndRefreshConversation({
        user: removed,
        community,
        removeAsLeader: false,
        notifForLeader: () => null,
        saveAsPendingCommunity: true,
      });

    const row = await userRepo.findOneOrFail({
      where: { id: removed.id },
      withDeleted: true,
      loadRelationIds: { relations: ["pendingCommunity"] },
    });
    expect(row.pendingCommunity).toBeNull();
  });

  it("leaves a group invite deleted while its invitee declines it", async () => {
    const [inviter, invitee] = await Promise.all([member(), member()]);
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Invite group",
      description: "Invite",
      leaders: [inviter],
      users: [inviter],
    });
    const invites = ctx.dataSource.getRepository(CommunityInvite);
    const invite = await invites.save({
      invitingUser: inviter,
      invitedUser: invitee,
      community,
      status: CommunityInviteStatus.InviteePending,
    });
    const findInvite = invites.findOneOrFail.bind(invites);
    jest
      .spyOn(invites, "findOneOrFail")
      .mockImplementationOnce(async (options) => {
        const loaded = await findInvite(options);
        await invites.softDelete(invite.id);
        return loaded;
      });

    await expect(
      ctx.app
        .get(CommunityService)
        .rejectCommunityInvite(invite.id, invitee.id),
    ).rejects.toThrow(NotFoundException);
    expect(
      await invites.findOneOrFail({
        where: { id: invite.id },
        withDeleted: true,
      }),
    ).toMatchObject({
      status: CommunityInviteStatus.InviteePending,
      deletedAt: expect.any(Date),
    });
  });

  it("leaves an invite link deleted while its owner edits it", async () => {
    const owner = await member();
    const shareUrls = ctx.app.get(ShareUrlsService);
    const link = await shareUrls.createDuplicateInviteForUser(
      owner.id,
      "Before",
      null,
    );
    const rows = ctx.dataSource.getRepository(ShareUrl);
    const findRow = rows.findOne.bind(rows);
    jest.spyOn(rows, "findOne").mockImplementationOnce(async (options) => {
      const loaded = await findRow(options);
      await rows.softDelete(link.id);
      return loaded;
    });

    await expect(
      shareUrls.updateInviteForUser({
        id: link.id,
        userId: owner.id,
        label: "After",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await rows.findOneOrFail({ where: { id: link.id }, withDeleted: true }),
    ).toMatchObject({ label: "Before", deletedAt: expect.any(Date) });
  });

  it("links no provider account to an account deleted mid-link", async () => {
    const user = await member();
    const oauth = ctx.app.get(OAuthAuthService);
    const linkable = oauth.linkable.bind(oauth);
    jest.spyOn(oauth, "linkable").mockImplementationOnce(async (params) => {
      const allowed = await linkable(params);
      await userRepo.softDelete(user.id);
      return allowed;
    });

    expect(
      await oauth.link({
        userId: user.id,
        profile: {
          provider: OAuthProvider.Google,
          subject: `deleted-mid-link-${user.id}`,
          email: "provider@example.com",
          emailVerified: true,
          name: "Provider Name",
        },
      }),
    ).toEqual(R.failure(OAuthError.Failed));
    expect(
      await ctx.dataSource
        .getRepository(OAuthAccount)
        .find({ where: { userId: user.id }, withDeleted: true }),
    ).toEqual([]);
  });

  it("makes no invite link into a group deleted after its leader check", async () => {
    const leader = await member();
    const communities = ctx.dataSource.getRepository(Community);
    const community = await communities.save({
      name: "Doomed group",
      description: "Doomed",
      leaders: [leader],
      users: [leader],
    });
    const users = ctx.app.get<Repository<User>>(getRepositoryToken(User));
    const findUser = users.findOne.bind(users);
    jest.spyOn(users, "findOne").mockImplementationOnce(async (options) => {
      const loaded = await findUser(options);
      await communities.softDelete(community.id);
      return loaded;
    });

    await expect(
      ctx.app
        .get(ShareUrlsService)
        .createDuplicateInviteForUser(leader.id, "Group link", community.id),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ShareUrl).find({
        where: { inviteAssignmentCommunityId: community.id },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("records no signature for an account deleted after it loads", async () => {
    const signer = await member();
    const users = ctx.app.get<Repository<User>>(getRepositoryToken(User));
    const findUser = users.findOneOrFail.bind(users);
    jest
      .spyOn(users, "findOneOrFail")
      .mockImplementationOnce(async (options) => {
        const loaded = await findUser(options);
        await userRepo.softDelete(signer.id);
        return loaded;
      });

    await expect(
      ctx.app.get(ContractService).signContract({
        userId: signer.id,
        signedName: "Signer",
        viaTaskForm: false,
        contractId: ctx.defaultContractId,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ContractEvent).find({
        where: { user: { id: signer.id } },
        withDeleted: true,
      }),
    ).toEqual([]);
  });

  it("tags no account deleted after it loads", async () => {
    const tagged = await member();
    deleteAfterUserLoad(tagged);

    await expect(
      userService.addUserToTag(ctx.defaultTag.id, tagged.id),
    ).rejects.toThrow(NotFoundException);
    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM "tag_users_user" WHERE "userId" = $1`,
      [tagged.id],
    );
    expect(count).toBe(0);
  });

  it("leaves an invite request deleted while its leader approves it", async () => {
    const leader = await member();
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Approving group",
      description: "Approving",
      leaders: [leader],
      users: [leader],
    });
    const invites = ctx.app.get<Repository<OnetimeInvite>>(
      getRepositoryToken(OnetimeInvite),
    );
    const request = await invites.save(
      invites.create({
        invitee: "Requested invitee",
        code: `request-${emails++}`,
        status: OnetimeInviteStatus.REQUEST_PENDING,
        community: { id: community.id },
      }),
    );
    const findInvite = invites.findOneOrFail.bind(invites);
    jest
      .spyOn(invites, "findOneOrFail")
      .mockImplementationOnce(async (options) => {
        const loaded = await findInvite(options);
        await invites.softDelete(request.id);
        return loaded;
      });

    await expect(
      userService.approveOrRejectOnetimeInviteRequest({
        userId: leader.id,
        inviteId: request.id,
        newStatus: "approve",
        message: "Approved [USER]",
      }),
    ).rejects.toThrow(NotFoundException);
    const stored = await invites.findOneOrFail({
      where: { id: request.id },
      withDeleted: true,
    });
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.status).toBe(OnetimeInviteStatus.REQUEST_PENDING);
  });

  it("drops a referrer deleted before the signup lands", async () => {
    const referrer = await member();
    await userRepo.softDelete(referrer.id);

    const signup = await userService.create({
      name: "Referred member",
      email: `referred-${emails++}@example.com`,
      password: "password",
      referredBy: referrer,
    });

    expect(
      (await userRepo.findOneByOrFail({ id: signup.id })).referredById,
    ).toBeNull();
  });

  describe("a member deleted after a membership edit loads the group", () => {
    const setUp = async () => {
      const leader = await member();
      const departing = await member();
      const communities = ctx.dataSource.getRepository(Community);
      const { id } = await communities.save({
        name: "Group losing a member",
        description: "Shrinking",
        leaders: [leader, departing],
        users: [leader, departing],
      });
      const community = await communities.findOneOrFail({
        where: { id },
        relations: { users: true, leaders: true },
      });
      const deleteDeparting = async () => {
        await userRepo.softDelete(departing.id);
        for (const table of [
          "community_users_user",
          "community_leaders_user",
        ]) {
          await ctx.dataSource.query(
            `DELETE FROM ${table} WHERE "userId" = $1`,
            [departing.id],
          );
        }
      };
      const memberships = async (): Promise<number> =>
        (
          await ctx.dataSource.query(
            `SELECT (SELECT count(*) FROM community_users_user WHERE "userId" = $1)
                  + (SELECT count(*) FROM community_leaders_user WHERE "userId" = $1) AS count`,
            [departing.id],
          )
        )[0].count;
      return { leader, community, deleteDeparting, memberships };
    };

    it("writes none of its memberships back when someone joins", async () => {
      const { community, deleteDeparting, memberships } = await setUp();
      const joiner = await member();
      await giveActiveContract(ctx, joiner.id);
      await deleteDeparting();

      await ctx.app
        .get(CommunityService)
        .addUsersToCommunityAndRefreshConversation({
          community,
          user: joiner,
          notifForLeader: () => null,
        });

      expect(Number(await memberships())).toBe(0);
    });

    it("writes none of its memberships back when a leader steps down", async () => {
      const { leader, community, deleteDeparting, memberships } = await setUp();
      const communityService = ctx.app.get(CommunityService);
      jest
        .spyOn(communityService, "findOneOrFail")
        .mockImplementationOnce(async () => {
          await deleteDeparting();
          return community;
        });

      await communityService.removeLeaderAdmin(community.id, leader.id);

      expect(Number(await memberships())).toBe(0);
    });
  });

  it("makes a leader of a member a concurrent request already promoted", async () => {
    const leader = await member();
    const promoted = await member();
    const { id } = await ctx.dataSource.getRepository(Community).save({
      name: "Group promoting twice",
      description: "Twice",
      leaders: [leader],
      users: [leader],
    });
    const communityService = ctx.app.get(CommunityService);
    const findOneOrFail = communityService.findOneOrFail.bind(communityService);
    jest
      .spyOn(communityService, "findOneOrFail")
      .mockImplementationOnce(async (...args) => {
        const loaded = await findOneOrFail(...args);
        for (const table of [
          "community_users_user",
          "community_leaders_user",
        ]) {
          await ctx.dataSource.query(
            `INSERT INTO ${table} ("communityId", "userId") VALUES ($1, $2)`,
            [id, promoted.id],
          );
        }
        return loaded;
      });

    await communityService.addLeaderAdmin(id, promoted.id);

    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM community_leaders_user WHERE "userId" = $1`,
      [promoted.id],
    );
    expect(count).toBe(1);
  });

  it("waits on a suspended member before locking their group, as admin placement does", async () => {
    const suspended = await member();
    const communities = ctx.dataSource.getRepository(Community);
    const { id } = await communities.save({
      name: "Group losing a suspended member",
      description: "Suspending",
      leaders: [],
      users: [suspended],
    });
    const community = await communities.findOneOrFail({
      where: { id },
      relations: { users: true, leaders: true },
    });
    const placement = ctx.dataSource.createQueryRunner();
    await placement.connect();
    try {
      await placement.startTransaction();
      await placement.query(`SELECT 1 FROM "user" WHERE id = $1 FOR UPDATE`, [
        suspended.id,
      ]);
      const removal = ctx.app
        .get(CommunityService)
        .removeUserFromCommunityAndRefreshConversation({
          user: suspended,
          community,
          removeAsLeader: true,
          notifForLeader: () => null,
          saveAsPendingCommunity: true,
        });
      await waitForLockWait(ctx.dataSource);
      await placement.query(
        `SELECT 1 FROM community WHERE id = $1 FOR UPDATE NOWAIT`,
        [id],
      );
      await placement.commitTransaction();
      await removal;
    } finally {
      await placement.release();
    }
    expect(
      await userRepo.findOneOrFail({
        where: { id: suspended.id },
        loadRelationIds: { relations: ["pendingCommunity"] },
      }),
    ).toMatchObject({ pendingCommunity: id });
  });

  it("joins no one to a group deleted after it loads", async () => {
    const leader = await member();
    const joiner = await member();
    await giveActiveContract(ctx, joiner.id);
    const communities = ctx.dataSource.getRepository(Community);
    const saved = await communities.save({
      name: "Group deleted mid-join",
      description: "Doomed",
      leaders: [leader],
      users: [leader],
    });
    const community = await communities.findOneOrFail({
      where: { id: saved.id },
      relations: { users: true, leaders: true },
    });
    await communities.softDelete(community.id);

    await expect(
      ctx.app.get(CommunityService).addUsersToCommunityAndRefreshConversation({
        community,
        user: joiner,
        notifForLeader: () => null,
      }),
    ).rejects.toThrow(NotFoundException);
    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM community_users_user WHERE "userId" = $1`,
      [joiner.id],
    );
    expect(count).toBe(0);
  });

  it("records no push to an account deleted before it is sent", async () => {
    const recipient = await member();
    await userRepo.softDelete(recipient.id);

    const pushes = await ctx.app.get(PushService).sendMessages([
      {
        userId: recipient.id,
        expoPushToken: "ExponentPushToken[deleted-recipient]",
        body: "Hello",
        idempotencyKey: `deleted-recipient-${emails++}`,
      },
    ]);

    expect(pushes).toEqual([]);
    expect(
      await ctx.dataSource.getRepository(Push).count({
        where: { user: { id: recipient.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("leaves an account deleted while its profile is edited", async () => {
    const user = await member({ name: "Before" });
    deleteAfterUserLoad(user);

    await expect(
      userService.update(user.id, { name: "After" }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await userRepo.findOneOrFail({
        where: { id: user.id },
        withDeleted: true,
      }),
    ).toMatchObject({ name: "Before", deletedAt: expect.any(Date) });
  });

  it("leaves a group deleted while it is edited", async () => {
    const communities = ctx.dataSource.getRepository(Community);
    const community = await communities.save({
      name: "Before",
      description: "Edited",
    });
    const images = ctx.app.get(ImagesService);
    const resolvePhotoUpdate = images.resolvePhotoUpdate.bind(images);
    jest
      .spyOn(images, "resolvePhotoUpdate")
      .mockImplementationOnce(async (photo) => {
        await communities.softDelete(community.id);
        return resolvePhotoUpdate(photo);
      });

    await expect(
      ctx.app
        .get(CommunityService)
        .updateCommunity(community.id, { name: "After" }, ctx.adminUserId),
    ).rejects.toThrow(NotFoundException);
    expect(
      await communities.findOneOrFail({
        where: { id: community.id },
        withDeleted: true,
      }),
    ).toMatchObject({ name: "Before", deletedAt: expect.any(Date) });
  });

  it("adds a like to a fresh notification when the unread one goes mid-like", async () => {
    const [owner, first, second] = await Promise.all([
      member(),
      member(),
      member(),
    ]);
    const likes = ctx.app.get(LikeNotificationService);
    const like = (liker: User) =>
      likes.createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: owner.id,
        webAppLocation: "/forum",
        targetContent: "Liked post",
      });
    await like(first);
    const notifs = ctx.dataSource.getRepository(Notification);
    const original = await notifs.findOneByOrFail({ user: { id: owner.id } });

    await writeDuringDeletion({
      dataSource: ctx.dataSource,
      target: Notification,
      id: original.id,
      write: () => like(second),
    });

    expect(
      await notifs.find({
        where: { user: { id: owner.id } },
        relations: { associatedUsers: true },
        withDeleted: true,
        order: { id: "ASC" },
      }),
    ).toMatchObject([
      { id: original.id, deletedAt: expect.any(Date) },
      { deletedAt: null, associatedUsers: [{ id: second.id }] },
    ]);
  });

  describe("a chat participant deleted after a write loads it", () => {
    const setUp = async () => {
      const [leader, invitee] = await Promise.all([member(), member()]);
      const community = await ctx.dataSource.getRepository(Community).save({
        name: "Chatting group",
        description: "Chatting",
        leaders: [leader],
        users: [leader, invitee],
      });
      const conversations = ctx.app.get(ConversationService);
      const conversation = await conversations.syncCommunityConversationMembers(
        community.id,
      );
      await ctx.dataSource
        .getRepository(Message)
        .save({ body: "Hello", author: leader, conversation });
      const participants = ctx.dataSource.getRepository(Participant);
      const participant = await participants.findOneByOrFail({
        conversation: { id: conversation.id },
        user: { id: invitee.id },
      });
      await participants.update(participant.id, {
        state: ParticipantState.Invited,
      });
      const stored = () =>
        participants.findOneOrFail({
          where: { id: participant.id },
          withDeleted: true,
        });
      return {
        conversations,
        community,
        conversationId: conversation.id,
        invitee,
        deleteParticipant: () => participants.softDelete(participant.id),
        stored,
      };
    };

    const unchanged = {
      state: ParticipantState.Invited,
      lastReadMessageId: null,
      deletedAt: expect.any(Date),
    };

    it.each([
      ["accepting its invite", "acceptInvite"],
      ["marking the chat read", "markConversationRead"],
    ] as const)("stays deleted through %s", async (_, write) => {
      const {
        conversations,
        conversationId,
        invitee,
        deleteParticipant,
        stored,
      } = await setUp();
      const load = conversations.getParticipantOrFail.bind(conversations);
      jest
        .spyOn(conversations, "getParticipantOrFail")
        .mockImplementationOnce(async (lookup) => {
          const loaded = await load(lookup);
          await deleteParticipant();
          return loaded;
        });

      await expect(
        conversations[write](conversationId, invitee.id),
      ).rejects.toThrow();
      expect(await stored()).toMatchObject(unchanged);
    });

    it("stays deleted through a membership sync", async () => {
      const { conversations, community, deleteParticipant, stored } =
        await setUp();
      const repo = ctx.app.get<Repository<Conversation>>(
        getRepositoryToken(Conversation),
      );
      const load = repo.findOneOrFail.bind(repo);
      jest
        .spyOn(repo, "findOneOrFail")
        .mockImplementationOnce(async (options) => {
          const loaded = await load(options);
          await deleteParticipant();
          return loaded;
        });

      await conversations.syncCommunityConversationMembers(community.id);

      expect(await stored()).toMatchObject(unchanged);
    });
  });
});

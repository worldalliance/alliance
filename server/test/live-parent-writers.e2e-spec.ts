import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthService } from "src/auth/auth.service";
import { Guest } from "src/auth/entities/guest.entity";
import { OAuthAccount } from "src/auth/oauth/oauth-account.entity";
import { OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import { CommunityService } from "src/community/community.service";
import { Community } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import { lockLiveIds } from "src/datasources/soft-delete";
import { ImagesService } from "src/images/images.service";
import { Push } from "src/push/push.entity";
import { PushService } from "src/push/push.service";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { AwayRangeEditor } from "src/user/away-range-history";
import { AmbassadorProgramMember } from "src/user/entities/ambassador-program-member.entity";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
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
});

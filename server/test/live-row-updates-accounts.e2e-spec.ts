import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AuthService } from "src/auth/auth.service";
import { Guest } from "src/auth/entities/guest.entity";
import { CommunityMembershipService } from "src/community/community-membership.service";
import { CommunityService } from "src/community/community.service";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import { ImagesService } from "src/images/images.service";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { InviteShareUrlsService } from "src/share-urls/invite-share-urls.service";
import { AccountEmailService } from "src/user/account-email.service";
import { AwayRangeEditor } from "src/user/away-range-history";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "src/user/entities/user-away-range.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import { OnetimeInviteService } from "src/user/onetime-invite.service";
import { UserAwayRangeService } from "src/user/user-away-range.service";
import { UserDeviceService } from "src/user/user-device.service";
import { UserService } from "src/user/user.service";
import type { EntityManager, Repository } from "typeorm";
import {
  createTestApp,
  deleteAfterUserLoad,
  TestContext,
} from "./e2e-test-utils";

describe("Account and group updates to a row deleted after its load (e2e)", () => {
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

  it("leaves a deleted guest unlinked", async () => {
    const user = await member();
    const { guestId } = await ctx.app.get(AuthService).createGuestSession();
    const guests = ctx.dataSource.getRepository(Guest);
    await guests.softDelete(guestId);

    await ctx.app.get(AuthService).mergeGuestIntoUser(guestId, user.id);

    const guest = await guests.findOneOrFail({
      where: { id: guestId },
      withDeleted: true,
      loadRelationIds: true,
    });
    expect(guest.linkedUser).toBeNull();
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
        ctx.app.get(UserAwayRangeService).updateAwayRange({
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
        ctx.app.get(UserAwayRangeService).deleteAwayRange({
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

    const registered = await ctx.app
      .get(UserDeviceService)
      .registerDevice(next.id, {
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
      .get(CommunityMembershipService)
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
    const inviteShareUrls = ctx.app.get(InviteShareUrlsService);
    const link = await inviteShareUrls.createDuplicateInviteForUser(
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
      inviteShareUrls.updateInviteForUser({
        id: link.id,
        userId: owner.id,
        label: "After",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await rows.findOneOrFail({ where: { id: link.id }, withDeleted: true }),
    ).toMatchObject({ label: "Before", deletedAt: expect.any(Date) });
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
      ctx.app.get(OnetimeInviteService).approveOrRejectOnetimeInviteRequest({
        userId: leader.id,
        inviteId: request.id,
        newStatus: "approve",
      }),
    ).rejects.toThrow(NotFoundException);
    const stored = await invites.findOneOrFail({
      where: { id: request.id },
      withDeleted: true,
    });
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.status).toBe(OnetimeInviteStatus.REQUEST_PENDING);
  });

  it("leaves an account deleted while its profile is edited", async () => {
    const user = await member({ name: "Before" });
    deleteAfterUserLoad({ ctx, deleted: user });

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

  it("keeps the old password of an account deleted while it is reset", async () => {
    const user = await member();
    const { password } = await userRepo.findOneOrFail({
      where: { id: user.id },
      select: { password: true },
    });
    deleteAfterUserLoad({ ctx, deleted: user });

    await expect(userService.setPassword(user.id, "replaced")).rejects.toThrow(
      NotFoundException,
    );
    expect(
      await userRepo.findOneOrFail({
        where: { id: user.id },
        select: { password: true, deletedAt: true },
        withDeleted: true,
      }),
    ).toMatchObject({ password, deletedAt: expect.any(Date) });
  });

  it("verifies no email of a deleted account", async () => {
    const user = await member();
    const token = await ctx.app
      .get(AccountEmailService)
      .getVerifyEmailToken(user.id);
    await userRepo.softDelete(user.id);

    await expect(
      ctx.app.get(AccountEmailService).verifyEmail(token),
    ).rejects.toThrow("Invalid or expired verification link");
    expect(
      await userRepo.findOneOrFail({
        where: { id: user.id },
        withDeleted: true,
      }),
    ).toMatchObject({ emailVerified: false });
  });

  it("neither renames nor queues an account deleted once its signature is recorded", async () => {
    const signer = await member({ name: "Before" });
    const manager = ctx.dataSource.manager;
    const transaction = manager.transaction.bind(manager);
    jest
      .spyOn(manager, "transaction")
      .mockImplementationOnce(
        async (...args: Parameters<EntityManager["transaction"]>) => {
          const recorded = await transaction(...args);
          await userRepo.softDelete(signer.id);
          return recorded;
        },
      );

    await ctx.app.get(ContractService).signContract({
      userId: signer.id,
      signedName: "After",
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });

    expect(
      await userRepo.findOneOrFail({
        where: { id: signer.id },
        withDeleted: true,
      }),
    ).toMatchObject({
      name: "Before",
      undergoingGroupAssignment: false,
      deletedAt: expect.any(Date),
    });
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
});

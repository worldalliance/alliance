import { OAuthProvider } from "@alliance/common/oauth";
import { NotFoundException } from "@nestjs/common";
import { ActionStatsService } from "src/actions/action-stats.service";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, CustomActionStat } from "src/actions/entities/action.entity";
import { TokenMode } from "src/auth/dto/signin.dto";
import { OAuthAccount } from "src/auth/oauth/oauth-account.entity";
import { OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import { Community } from "src/community/entities/community.entity";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { ConversationService } from "src/messaging/conversation.service";
import { Conversation } from "src/messaging/entities/conversation.entity";
import { Participant } from "src/messaging/entities/participant.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { Friend, FriendStatus } from "src/user/entities/friend.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createTestApp,
  signAccessToken,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

describe("Soft-deleted records' lifecycle (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const server = () => ctx.app.getHttpServer();
  const admin = () => `Bearer ${ctx.adminAccessToken}`;

  const member = async (
    overrides: Partial<User> = {},
  ): Promise<{ user: User; token: string }> => {
    const user = await userRepo.save(
      userRepo.create({
        name: `Lifecycle Member ${emails}`,
        email: `lifecycle-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );
    return { user, token: signAccessToken(ctx.jwtService, user) };
  };

  const deleteAccount = (user: User) =>
    request(server())
      .delete(`/user/userdetail/${user.id}`)
      .set("Authorization", admin())
      .send({ reason: "Requested", confirmationEmail: user.email })
      .expect(200);

  const register = (email: string, referralCode: string) =>
    request(server()).post("/auth/register").send({
      email,
      password: "password",
      name: "Invited Member",
      referralCode,
      mode: TokenMode.Header,
      timeZone: "America/Los_Angeles",
    });

  const all = <T extends { deletedAt: Date | null }>(
    repo: Repository<T>,
    where: Parameters<Repository<T>["find"]>[0],
  ) => repo.find({ ...where, withDeleted: true });

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("frees a deleted account's email for a new account", async () => {
    const { user } = await member();
    await deleteAccount(user);

    const successor = await member({ email: user.email });

    expect(successor.user.id).not.toBe(user.id);
    expect(
      await userRepo.findOne({ where: { id: user.id }, withDeleted: true }),
    ).toMatchObject({ email: user.email });
  });

  it("refuses a friend request to an account deleted while it waits", async () => {
    const requester = await member();
    const addressee = await member();
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [addressee.user.id],
      });
      const requested = ctx.app
        .get(UserService)
        .createFriendRequest(requester.user.id, addressee.user.id)
        .then(
          () => "requested",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await requested).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await all(ctx.dataSource.getRepository(Friend), {
        where: { requester: { id: requester.user.id } },
      }),
    ).toEqual([]);
  });

  it("keeps a friendship deleted when its acceptance waits on the deletion", async () => {
    const requester = await member();
    const addressee = await member();
    const users = ctx.app.get(UserService);
    await users.createFriendRequest(requester.user.id, addressee.user.id);
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [requester.user.id],
      });
      const accepted = users
        .updateFriendRequestStatus(
          requester.user.id,
          addressee.user.id,
          FriendStatus.Accepted,
        )
        .then(
          () => "accepted",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await accepted).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await all(ctx.dataSource.getRepository(Friend), {
        where: { requester: { id: requester.user.id } },
      }),
    ).toEqual([
      expect.objectContaining({
        status: FriendStatus.Pending,
        deletedAt: expect.any(Date),
      }),
    ]);
  });

  it("takes a new friend request after a removed friendship", async () => {
    const requester = await member();
    const addressee = await member();
    const requestFriend = () =>
      request(server())
        .post(`/user/friends/${addressee.user.id}`)
        .set("Authorization", `Bearer ${requester.token}`)
        .expect(201);

    await requestFriend();
    await request(server())
      .delete(`/user/friends/${addressee.user.id}`)
      .set("Authorization", `Bearer ${requester.token}`)
      .expect(200);
    await requestFriend();

    const rows = await all(ctx.dataSource.getRepository(Friend), {
      where: { requester: { id: requester.user.id } },
      order: { id: "ASC" },
    });
    expect(rows.map((row) => row.deletedAt === null)).toEqual([false, true]);
  });

  it("adds back a member who left a group conversation", async () => {
    const owner = await member();
    const leaver = await member();
    const other = await member();
    const conversation = await ctx.app
      .get(ConversationService)
      .createOrGetGroupConversation(owner.user.id, {
        title: "Group",
        participantIds: [leaver.user.id, other.user.id],
      });

    await request(server())
      .post(`/messaging/conversations/${conversation.id}/leave`)
      .set("Authorization", `Bearer ${leaver.token}`)
      .expect(201);
    await request(server())
      .post(`/messaging/conversations/${conversation.id}/participants`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: leaver.user.id })
      .expect(201);

    const rows = await all(ctx.dataSource.getRepository(Participant), {
      where: {
        conversation: { id: conversation.id },
        user: { id: leaver.user.id },
      },
      order: { id: "ASC" },
    });
    expect(rows.map((row) => row.deletedAt === null)).toEqual([false, true]);
  });

  it("links a provider again after unlinking it", async () => {
    const { user } = await member();
    const oauth = ctx.app.get(OAuthAuthService);
    const profile = {
      provider: OAuthProvider.Google,
      subject: `subject-${user.id}`,
      email: user.email,
      emailVerified: true,
      name: null,
    };

    expect((await oauth.link({ userId: user.id, profile })).ok).toBe(true);
    expect(
      (await oauth.unlink({ userId: user.id, provider: profile.provider })).ok,
    ).toBe(true);
    expect((await oauth.link({ userId: user.id, profile })).ok).toBe(true);

    const accounts = ctx.dataSource.getRepository(OAuthAccount);
    const rows = await all(accounts, {
      where: { userId: user.id },
      order: { id: "ASC" },
    });
    expect(rows.map((row) => row.deletedAt === null)).toEqual([false, true]);

    await oauth.unlink({ userId: user.id, provider: profile.provider });
    const [first] = await all(accounts, {
      where: { userId: user.id },
      order: { id: "ASC" },
    });
    expect(first.deletedAt).toEqual(rows[0].deletedAt);
  });

  it("refuses to link a provider to a deleted account", async () => {
    const { user } = await member();
    await deleteAccount(user);

    const linked = await ctx.app.get(OAuthAuthService).link({
      userId: user.id,
      profile: {
        provider: OAuthProvider.Google,
        subject: `subject-${user.id}`,
        email: user.email,
        emailVerified: true,
        name: null,
      },
    });

    expect(linked.ok).toBe(false);
    expect(
      await all(ctx.dataSource.getRepository(OAuthAccount), {
        where: { userId: user.id },
      }),
    ).toEqual([]);
  });

  it("reuses a deleted tag's name", async () => {
    const createTag = () =>
      request(server())
        .post("/user/createTag")
        .set("Authorization", admin())
        .send({
          name: "Recycled",
          description: "Recycled tag",
          publicDisplayName: "Recycled",
        })
        .expect(201);

    const first = (await createTag()).body;
    await request(server())
      .delete(`/user/tags/${first.id}`)
      .set("Authorization", admin())
      .expect(200);
    await request(server())
      .delete(`/user/tags/${first.id}`)
      .set("Authorization", admin())
      .expect(200);
    const second = (await createTag()).body;

    expect(second.id).not.toBe(first.id);
    expect(
      await all(ctx.dataSource.getRepository(Tag), {
        where: { name: "Recycled" },
      }),
    ).toHaveLength(2);
  });

  it("hides a deleted group, its chat, and its memberships", async () => {
    const leader = await member();
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Closing group",
      description: "Closing",
      users: [leader.user],
      leaders: [leader.user],
    });
    const chat = await ctx.app
      .get(ConversationService)
      .syncCommunityConversationMembers(community.id);

    await request(server())
      .delete(`/community/${community.id}/admin`)
      .set("Authorization", admin())
      .expect(200);

    expect(
      await ctx.dataSource
        .getRepository(Community)
        .findOne({ where: { id: community.id }, withDeleted: true }),
    ).toMatchObject({ deletedAt: expect.any(Date) });
    expect(
      await ctx.dataSource
        .getRepository(Conversation)
        .findOne({ where: { id: chat.id }, withDeleted: true }),
    ).toMatchObject({ deletedAt: expect.any(Date) });
    expect(
      await userRepo.findOneOrFail({
        where: { id: leader.user.id },
        relations: { communities: true, leaderOf: true },
      }),
    ).toMatchObject({ communities: [], leaderOf: [] });
  });

  it("frees an invite whose claimant's account was deleted", async () => {
    const { user: inviter } = await member();
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: "Claimant",
      code: "RECLAIMED-CODE",
      status: OnetimeInviteStatus.LINK_UNUSED,
      invitingUser: inviter,
    });
    await register("first-claimant@example.com", invite.code).expect(201);
    const first = await userRepo.findOneByOrFail({
      email: "first-claimant@example.com",
    });

    await deleteAccount(first);
    await register("second-claimant@example.com", invite.code).expect(201);

    expect(
      await userRepo.findOneOrFail({
        where: { email: "second-claimant@example.com" },
        relations: { referredByInvite: true },
      }),
    ).toMatchObject({ referredByInvite: { id: invite.id } });
  });

  it("keeps a deleted used invite in an action's invite count", async () => {
    const { user: inviter } = await member();
    const action = await ctx.dataSource.getRepository(Action).save({
      name: "Invite drive",
      category: [],
      body: "Invite",
      customStatType: CustomActionStat.USERS_INVITED,
    });
    const day = 24 * 60 * 60 * 1000;
    await ctx.dataSource.getRepository(ActionEvent).save([
      {
        title: "Start",
        description: "Start",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - day),
        action,
      },
      {
        title: "Deadline",
        description: "Deadline",
        newStatus: ActionStatus.OfficeAction,
        date: new Date(Date.now() + day),
        action,
      },
    ]);
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: "Counted",
      code: "COUNTED-CODE",
      status: OnetimeInviteStatus.LINK_USED,
      invitingUser: inviter,
    });
    const usersInvited = async () => {
      await ctx.app.get(ActionStatsService).computeCustomActionStats(
        await ctx.dataSource.getRepository(Action).findOneOrFail({
          where: { id: action.id },
          relations: { events: true },
        }),
      );
      return (
        await ctx.dataSource.getRepository(Action).findOneByOrFail({
          id: action.id,
        })
      ).customStatValue;
    };
    const before = await usersInvited();

    await request(server())
      .delete(`/user/onetimeInvites/${invite.id}`)
      .set("Authorization", admin())
      .expect(200);

    expect(before).toBeGreaterThan(0);
    expect(await usersInvited()).toBe(before);
  });
});

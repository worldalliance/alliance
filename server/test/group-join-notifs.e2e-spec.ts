import { CommunityService } from "src/community/community.service";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import {
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { NotifsService } from "src/notifs/notifs.service";
import { NotifPushDispatcherWorker } from "src/push/notif-push-dispatcher.worker";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { In, Not, type Repository } from "typeorm";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

describe("Group join notifications (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let communityRepo: Repository<Community>;
  let notifRepo: Repository<Notification>;
  let mmsRepo: Repository<Mms>;
  let communityService: CommunityService;
  let contractService: ContractService;
  let userService: UserService;
  let userCounter = 0;

  const createUser = async (
    overrides: Partial<User> = {},
    { signed = true }: { signed?: boolean } = {},
  ): Promise<User> => {
    userCounter += 1;
    const user = await userRepo.save(
      userRepo.create({
        name: `Join Member ${userCounter}`,
        email: `join.member.${userCounter}@example.com`,
        password: "pass",
        ...overrides,
      }),
    );
    if (signed) await giveActiveContract(ctx, user.id);
    return user;
  };

  const createGroup = (params: { leaders: User[]; members: User[] }) =>
    communityRepo.save(
      communityRepo.create({
        name: `Join Group ${++userCounter}`,
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: params.leaders,
        users: params.members,
      }),
    );

  const joinNotifs = () =>
    notifRepo.find({
      where: { category: NotificationCategory.GroupMemberJoined },
      relations: { user: true, associatedUsers: true },
      order: { id: "ASC" },
    });

  /** Recipient id → ids of the joiners they were told about. */
  const announcements = async () => {
    const byRecipient = new Map<number, number[]>();
    for (const notif of await joinNotifs()) {
      const joiners = notif.associatedUsers!.map((user) => user.id);
      byRecipient.set(notif.user!.id, [
        ...(byRecipient.get(notif.user!.id) ?? []),
        ...joiners,
      ]);
    }
    for (const joiners of byRecipient.values()) joiners.sort((a, b) => a - b);
    return byRecipient;
  };

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    communityRepo = ctx.dataSource.getRepository(Community);
    notifRepo = ctx.dataSource.getRepository(Notification);
    mmsRepo = ctx.dataSource.getRepository(Mms);
    communityService = ctx.app.get(CommunityService);
    contractService = ctx.app.get(ContractService);
    userService = ctx.app.get(UserService);
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await notifRepo.query("DELETE FROM notification");
    await mmsRepo.query("DELETE FROM mms");
    await notifRepo.query("DELETE FROM message_tracking");
    await notifRepo.query("DELETE FROM user_device");
    await notifRepo.query("DELETE FROM community_invite");
    await communityRepo.createQueryBuilder().delete().execute();
    await userRepo.delete({ id: Not(In([ctx.testUserId, ctx.adminUserId])) });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("tells every existing member and leader once, with the copy and destination, and not the joiner", async () => {
    const pausedLeader = await createUser({}, { signed: false });
    const outsideLeader = await createUser();
    const existing = await createUser();
    const group = await createGroup({
      leaders: [pausedLeader, outsideLeader],
      members: [pausedLeader, existing],
    });
    const joiner = await createUser({ name: "Jo Joiner" });

    await communityService.joinPublicCommunity(joiner.id, group.id);

    const notifs = await joinNotifs();
    expect(notifs.map((notif) => notif.user!.id).sort()).toEqual(
      [pausedLeader.id, outsideLeader.id, existing.id].sort(),
    );
    for (const notif of notifs) {
      expect(notif.message).toBe(`Jo Joiner joined ${group.name}!`);
      expect(notif.webAppLocation).toBe(
        `/groups?tab=members&communityId=${group.id}`,
      );
      expect(notif.associatedUsers!.map((user) => user.id)).toEqual([
        joiner.id,
      ]);
    }
    const legacy = await notifRepo.count({
      where: { category: NotificationCategory.MemberJoinedCommunity },
    });
    expect(legacy).toBe(2);
  });

  it("creates none when a group is created", async () => {
    const founder = await createUser();

    await communityService.createCommunity(founder.id, {
      name: "Fresh Group",
      description: "",
      public: false,
      allowMemberInvites: true,
      allowStaffAssignments: true,
      maxCapacity: 10,
    });

    expect(await joinNotifs()).toEqual([]);
  });

  it("tells neither newcomer in a batch about the other, and a later join reaches both", async () => {
    const leader = await createUser();
    const existing = await createUser();
    const group = await createGroup({
      leaders: [leader],
      members: [leader, existing],
    });
    const first = await createUser({ undergoingGroupAssignment: true });
    const second = await createUser({ undergoingGroupAssignment: true });

    await userService.assignGroupsAdmin({
      assignments: [
        { userId: first.id, communityId: group.id },
        { userId: second.id, communityId: group.id },
      ],
    });

    const batch = [first.id, second.id].sort((a, b) => a - b);
    expect(await announcements()).toEqual(
      new Map([
        [leader.id, batch],
        [existing.id, batch],
      ]),
    );

    const later = await createUser();
    await communityService.joinPublicCommunity(later.id, group.id);

    const afterLater = await announcements();
    expect(afterLater.get(first.id)).toEqual([later.id]);
    expect(afterLater.get(second.id)).toEqual([later.id]);
  });

  it("keeps a batch's leaders in their group's audience and drops members moving out", async () => {
    const leaving = await createUser({ undergoingGroupAssignment: true });
    const staying = await createUser({ undergoingGroupAssignment: true });
    const source = await createGroup({
      leaders: [staying],
      members: [staying, leaving],
    });
    const destinationLeader = await createUser();
    const destination = await createGroup({
      leaders: [destinationLeader],
      members: [destinationLeader],
    });
    const newcomer = await createUser({ undergoingGroupAssignment: true });

    await userService.assignGroupsAdmin({
      assignments: [
        { userId: leaving.id, communityId: destination.id },
        { userId: staying.id, communityId: destination.id },
        { userId: newcomer.id, communityId: source.id },
      ],
    });

    expect(await announcements()).toEqual(
      new Map([
        [staying.id, [newcomer.id]],
        [destinationLeader.id, [leaving.id, staying.id].sort((a, b) => a - b)],
      ]),
    );
  });

  it("announces a rejoin after leaving as a new join", async () => {
    const leader = await createUser();
    const group = await createGroup({ leaders: [leader], members: [leader] });
    const member = await createUser();

    await communityService.joinPublicCommunity(member.id, group.id);
    await communityService.leaveCommunity(group.id, member.id);
    await communityService.joinPublicCommunity(member.id, group.id);

    expect((await announcements()).get(leader.id)).toEqual([
      member.id,
      member.id,
    ]);
  });

  it("announces staff placements and transfers, accepted invitations, and leader assignment of a non-member", async () => {
    const leader = await createUser();
    const group = await createGroup({ leaders: [leader], members: [leader] });
    const otherGroup = await createGroup({ leaders: [], members: [] });
    const placed = await createUser();
    const moved = await createUser();
    const invited = await createUser();
    const promoted = await createUser();

    await communityService.addUserToCommunityAdmin({
      communityId: group.id,
      userId: placed.id,
    });
    await communityService.addUserToCommunityAdmin({
      communityId: otherGroup.id,
      userId: moved.id,
    });
    await communityService.moveUserBetweenCommunitiesAdmin({
      sourceCommunityId: otherGroup.id,
      destinationCommunityId: group.id,
      userId: moved.id,
    });
    const invite = await ctx.dataSource.getRepository(CommunityInvite).save({
      status: CommunityInviteStatus.InviteePending,
      invitingUser: leader,
      invitedUser: invited,
      community: group,
    });
    await communityService.acceptCommunityInvite(invite.id, invited.id);
    await communityService.addLeaderAdmin(group.id, promoted.id);
    await communityService.addLeaderAdmin(group.id, placed.id);

    expect((await announcements()).get(leader.id)).toEqual(
      [placed.id, moved.id, invited.id, promoted.id].sort((a, b) => a - b),
    );
  });

  it("announces a return after contract reinstatement", async () => {
    const leader = await createUser();
    const member = await createUser();
    const group = await createGroup({
      leaders: [leader],
      members: [leader, member],
    });

    await contractService.suspendContract({ userId: member.id });
    await contractService.signContract({
      userId: member.id,
      signedName: member.name,
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });

    const returned = await communityRepo.findOneOrFail({
      where: { id: group.id },
      relations: { users: true },
    });
    expect(returned.users.map((user) => user.id)).toContain(member.id);
    expect((await announcements()).get(leader.id)).toEqual([member.id]);
  });

  it("texts only recipients who opted in with a usable, subscribed number, and keeps every in-app entry", async () => {
    const texted = await createUser({
      textsForNewGroupMembers: true,
      phoneNumber: "+14155550101",
    });
    const unsubscribed = await createUser({
      textsForNewGroupMembers: true,
      phoneNumber: "+14155550102",
      phoneNumberUnsubscribed: true,
    });
    const optedOut = await createUser({
      textsForNewGroupMembers: true,
      phoneNumber: "+14155550103",
      turnedOffAllNotifs: true,
    });
    const noPhone = await createUser({ textsForNewGroupMembers: true });
    const defaulted = await createUser({ phoneNumber: "+14155550104" });
    const actionTexts = await createUser({
      textsForNewGroupMembers: false,
      textNotifsForActions: true,
      phoneNumber: "+14155550105",
    });
    const members = [
      texted,
      unsubscribed,
      optedOut,
      noPhone,
      defaulted,
      actionTexts,
    ];
    const group = await createGroup({ leaders: [texted], members });
    const joiner = await createUser({ name: "Tex Joiner" });

    await communityService.joinPublicCommunity(joiner.id, group.id);

    expect((await joinNotifs()).length).toBe(members.length);
    const texts = await mmsRepo.find();
    expect(texts.map((mms) => mms.to)).toEqual([texted.phoneNumber]);
    expect(texts[0].body).toMatch(
      new RegExp(
        `^Tex Joiner joined ${group.name}! \\S*/groups\\?tab=members&communityId=${group.id}`,
      ),
    );
    const notif = await notifRepo.findOneOrFail({
      where: {
        category: NotificationCategory.GroupMemberJoined,
        user: { id: texted.id },
      },
    });
    const tracking = await ctx.dataSource
      .getRepository(MessageTracking)
      .findOneByOrFail({ trackingId: texts[0].cid! });
    expect(tracking).toMatchObject({
      source: MessageSource.GroupJoin,
      userId: texted.id,
      context: { notificationIds: [notif.id] },
    });
  });

  it("pushes per the new push setting and the overall opt-out, regardless of action-reminder push", async () => {
    const pushed = await createUser();
    const pushOff = await createUser({ pushesForNewGroupMembers: false });
    const optedOut = await createUser({ turnedOffAllNotifs: true });
    const actionPushOff = await createUser({ pushNotifsForActions: false });
    const members = [pushed, pushOff, optedOut, actionPushOff];
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    const past = new Date(Date.now() - 60_000);
    for (const user of members) {
      const device = await deviceRepo.save({
        user,
        deviceType: "iOS",
        expoPushToken: `ExponentPushToken[join_${user.id}]`,
      });
      await deviceRepo.update(device.id, { createdAt: past });
    }
    const group = await createGroup({ leaders: [pushed], members });
    const joiner = await createUser();

    await communityService.joinPublicCommunity(joiner.id, group.id);
    await notifRepo.update(
      { category: Not(NotificationCategory.GroupMemberJoined) },
      { shouldPush: false },
    );

    const messages = await ctx.app
      .get(NotifPushDispatcherWorker)
      .findNotificationPushes("group-join-test");

    expect(messages.map((message) => message.userId).sort()).toEqual(
      [pushed.id, actionPushOff.id].sort(),
    );
  });

  it("keeps the join and its existing notifications when saving the new ones fails", async () => {
    const leader = await createUser();
    const group = await createGroup({ leaders: [leader], members: [leader] });
    const joiner = await createUser();
    const notifsService = ctx.app.get(NotifsService);
    const sendNotifs = notifsService.sendNotifs.bind(notifsService);
    jest
      .spyOn(notifsService, "sendNotifs")
      .mockImplementation((notifs) =>
        notifs.some(
          (notif) => notif.category === NotificationCategory.GroupMemberJoined,
        )
          ? Promise.reject(new Error("notification write failed"))
          : sendNotifs(notifs),
      );

    await communityService.joinPublicCommunity(joiner.id, group.id);

    const joined = await communityRepo.findOneOrFail({
      where: { id: group.id },
      relations: { users: true },
    });
    expect(joined.users.map((user) => user.id)).toContain(joiner.id);
    expect(await joinNotifs()).toEqual([]);
    expect(
      await notifRepo.count({
        where: { category: NotificationCategory.MemberJoinedCommunity },
      }),
    ).toBe(1);
  });

  it("keeps the join and its in-app entries when a text fails to send", async () => {
    const leader = await createUser({
      textsForNewGroupMembers: true,
      phoneNumber: "+14155550106",
    });
    const group = await createGroup({ leaders: [leader], members: [leader] });
    const joiner = await createUser();
    jest
      .spyOn(ctx.app.get(MmsService), "sendMms")
      .mockRejectedValue(new Error("twilio is down"));

    await communityService.joinPublicCommunity(joiner.id, group.id);

    expect((await announcements()).get(leader.id)).toEqual([joiner.id]);
  });
});

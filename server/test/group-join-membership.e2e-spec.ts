import { CommunityService } from "src/community/community.service";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "src/community/entities/community-invite.entity";
import { loadedCommunityUsers } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import { MessagingModule } from "src/messaging/messaging.module";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { ReferralSource } from "src/user/entities/user.entity";
import { GroupAssignmentService } from "src/user/group-assignment.service";
import { createTestApp, TestContext } from "./e2e-test-utils";
import { GroupJoinFixtures } from "./group-join-fixtures";

describe("Group join notifications: audience and triggers (e2e)", () => {
  let ctx: TestContext;
  let fx: GroupJoinFixtures;
  let communityService: CommunityService;
  let contractService: ContractService;
  let groupAssignmentService: GroupAssignmentService;

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    fx = new GroupJoinFixtures(ctx);
    communityService = ctx.app.get(CommunityService);
    contractService = ctx.app.get(ContractService);
    groupAssignmentService = ctx.app.get(GroupAssignmentService);
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await fx.cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("tells every existing member and leader once, with the copy and destination, and not the joiner", async () => {
    const pausedLeader = await fx.createUser({}, { signed: false });
    const outsideLeader = await fx.createUser();
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [pausedLeader, outsideLeader],
      members: [pausedLeader, existing],
    });
    const joiner = await fx.createUser({ name: "Jo Joiner" });

    await communityService.joinPublicCommunity(joiner.id, group.id);

    const notifs = await fx.joinNotifs();
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
    const legacy = await fx.notifRepo.count({
      where: { category: NotificationCategory.MemberJoinedCommunity },
    });
    expect(legacy).toBe(2);
  });

  it("creates none when a group is created", async () => {
    const founder = await fx.createUser();

    await communityService.createCommunity(founder.id, {
      name: "Fresh Group",
      description: "",
      public: false,
      allowMemberInvites: true,
      allowStaffAssignments: true,
      maxCapacity: 10,
    });

    expect(await fx.joinNotifs()).toEqual([]);
  });

  it("tells neither newcomer in a batch about the other, and a later join reaches both", async () => {
    const leader = await fx.createUser();
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader, existing],
    });
    const first = await fx.createUser({ undergoingGroupAssignment: true });
    const second = await fx.createUser({ undergoingGroupAssignment: true });

    await groupAssignmentService.assignGroupsAdmin({
      assignments: [
        { userId: first.id, communityId: group.id },
        { userId: second.id, communityId: group.id },
      ],
    });

    const batch = [first.id, second.id].sort((a, b) => a - b);
    expect(await fx.announcements()).toEqual(
      new Map([
        [leader.id, batch],
        [existing.id, batch],
      ]),
    );

    const later = await fx.createUser();
    await communityService.joinPublicCommunity(later.id, group.id);

    const afterLater = await fx.announcements();
    expect(afterLater.get(first.id)).toEqual([later.id]);
    expect(afterLater.get(second.id)).toEqual([later.id]);
  });

  it("keeps a batch's leaders in their group's audience and drops members moving out", async () => {
    const leaving = await fx.createUser({ undergoingGroupAssignment: true });
    const staying = await fx.createUser({ undergoingGroupAssignment: true });
    const source = await fx.createGroup({
      leaders: [staying],
      members: [staying, leaving],
    });
    const destinationLeader = await fx.createUser();
    const destination = await fx.createGroup({
      leaders: [destinationLeader],
      members: [destinationLeader],
    });
    const newcomer = await fx.createUser({ undergoingGroupAssignment: true });

    await groupAssignmentService.assignGroupsAdmin({
      assignments: [
        { userId: leaving.id, communityId: destination.id },
        { userId: staying.id, communityId: destination.id },
        { userId: newcomer.id, communityId: source.id },
      ],
    });

    expect(await fx.announcements()).toEqual(
      new Map([
        [staying.id, [newcomer.id]],
        [destinationLeader.id, [leaving.id, staying.id].sort((a, b) => a - b)],
      ]),
    );
  });

  it("announces a rejoin after leaving as a new join", async () => {
    const leader = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader],
    });
    const member = await fx.createUser();

    await communityService.joinPublicCommunity(member.id, group.id);
    await communityService.leaveCommunity(group.id, member.id);
    await communityService.joinPublicCommunity(member.id, group.id);

    expect((await fx.announcements()).get(leader.id)).toEqual([
      member.id,
      member.id,
    ]);
  });

  it("announces staff placements and transfers, accepted invitations, and leader assignment of a non-member", async () => {
    const leader = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader],
    });
    const otherGroup = await fx.createGroup({ leaders: [], members: [] });
    const placed = await fx.createUser();
    const moved = await fx.createUser();
    const invited = await fx.createUser();
    const promoted = await fx.createUser();

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

    expect((await fx.announcements()).get(leader.id)).toEqual(
      [placed.id, moved.id, invited.id, promoted.id].sort((a, b) => a - b),
    );
  });

  it("announces a return after contract reinstatement", async () => {
    const leader = await fx.createUser();
    const member = await fx.createUser();
    const group = await fx.createGroup({
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

    const returned = await fx.communityRepo.findOneOrFail({
      where: { id: group.id },
      relations: { users: true },
    });
    expect(loadedCommunityUsers(returned).map((user) => user.id)).toContain(
      member.id,
    );
    expect((await fx.announcements()).get(leader.id)).toEqual([member.id]);
  });

  it("announces a first signing through a group invite link", async () => {
    const leader = await fx.createUser();
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader, existing],
    });
    const invite = await ctx.dataSource.getRepository(OnetimeInvite).save({
      invitee: "Claimant",
      code: `join-invite-${group.id}`,
      status: OnetimeInviteStatus.LINK_USED,
      community: group,
    });
    const claimant = await fx.createUser(
      {
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      },
      { signed: false },
    );

    await contractService.signContract({
      userId: claimant.id,
      signedName: claimant.name,
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });

    const byRecipient = await fx.announcements();
    expect([...byRecipient.keys()].sort()).toEqual(
      [leader.id, existing.id].sort(),
    );
    expect(byRecipient.get(existing.id)).toEqual([claimant.id]);
  });
});

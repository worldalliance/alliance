import { CommunityInvitesService } from "src/community/community-invites.service";
import { CommunityParticipationService } from "src/community/community-participation.service";
import { CommunityPlacementService } from "src/community/community-placement.service";
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
import { ReferralSource, User } from "src/user/entities/user.entity";
import { GroupAssignmentService } from "src/user/group-assignment.service";
import { createTestApp, TestContext } from "./e2e-test-utils";
import { GroupJoinFixtures } from "./group-join-fixtures";

describe("Group join notifications: audience and triggers (e2e)", () => {
  let ctx: TestContext;
  let fx: GroupJoinFixtures;
  let communityService: CommunityService;
  let communityParticipationService: CommunityParticipationService;
  let communityPlacementService: CommunityPlacementService;
  let communityInvitesService: CommunityInvitesService;
  let contractService: ContractService;
  let groupAssignmentService: GroupAssignmentService;

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    fx = new GroupJoinFixtures(ctx);
    communityService = ctx.app.get(CommunityService);
    communityParticipationService = ctx.app.get(CommunityParticipationService);
    communityPlacementService = ctx.app.get(CommunityPlacementService);
    communityInvitesService = ctx.app.get(CommunityInvitesService);
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

  it("tells every existing member once, with the copy and destination, and neither the leaders nor the joiner", async () => {
    const memberLeader = await fx.createUser();
    const outsideLeader = await fx.createUser();
    const pausedMember = await fx.createUser({}, { signed: false });
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [memberLeader, outsideLeader],
      members: [memberLeader, pausedMember, existing],
    });
    const joiner = await fx.createUser({ name: "Jo Joiner" });

    await communityParticipationService.joinPublicCommunity(
      joiner.id,
      group.id,
    );

    const notifs = await fx.joinNotifs();
    expect(notifs.map((notif) => notif.user!.id).sort()).toEqual(
      [pausedMember.id, existing.id].sort(),
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
    expect(await fx.announcements()).toEqual(new Map([[existing.id, batch]]));
    const leaderNotices = await fx.notifRepo.find({
      where: { user: { id: leader.id } },
      relations: { associatedUsers: true },
    });
    expect(
      leaderNotices
        .sort((a, b) => a.associatedUsers![0].id - b.associatedUsers![0].id)
        .map((notif) => [notif.category, notif.associatedUsers![0].id]),
    ).toEqual(
      batch.map((id) => [NotificationCategory.MemberJoinedCommunity, id]),
    );

    const later = await fx.createUser();
    await communityParticipationService.joinPublicCommunity(later.id, group.id);

    const afterLater = await fx.announcements();
    expect(afterLater.get(first.id)).toEqual([later.id]);
    expect(afterLater.get(second.id)).toEqual([later.id]);
  });

  it("drops a batch's members moving out of a group from its audience, and keeps its leaders out", async () => {
    const leaving = await fx.createUser({ undergoingGroupAssignment: true });
    const staying = await fx.createUser({ undergoingGroupAssignment: true });
    const sourceMember = await fx.createUser();
    const source = await fx.createGroup({
      leaders: [staying],
      members: [staying, leaving, sourceMember],
    });
    const destinationLeader = await fx.createUser();
    const destinationMember = await fx.createUser();
    const destination = await fx.createGroup({
      leaders: [destinationLeader],
      members: [destinationLeader, destinationMember],
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
        [sourceMember.id, [newcomer.id]],
        [destinationMember.id, [leaving.id, staying.id].sort((a, b) => a - b)],
      ]),
    );
  });

  it("announces a rejoin after leaving as a new join", async () => {
    const existing = await fx.createUser();
    const group = await fx.createGroup({ leaders: [], members: [existing] });
    const member = await fx.createUser();

    await communityParticipationService.joinPublicCommunity(
      member.id,
      group.id,
    );
    await communityParticipationService.leaveCommunity(group.id, member.id);
    await communityParticipationService.joinPublicCommunity(
      member.id,
      group.id,
    );

    expect((await fx.announcements()).get(existing.id)).toEqual([
      member.id,
      member.id,
    ]);
  });

  it("announces staff placements and transfers, accepted invitations, and leader assignment of a non-member", async () => {
    const leader = await fx.createUser();
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader, existing],
    });
    const otherGroup = await fx.createGroup({ leaders: [], members: [] });
    const placed = await fx.createUser();
    const moved = await fx.createUser();
    const invited = await fx.createUser();
    const promoted = await fx.createUser();

    await communityPlacementService.addUserToCommunityAdmin({
      communityId: group.id,
      userId: placed.id,
    });
    await communityPlacementService.addUserToCommunityAdmin({
      communityId: otherGroup.id,
      userId: moved.id,
    });
    await communityPlacementService.moveUserBetweenCommunitiesAdmin({
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
    await communityInvitesService.acceptCommunityInvite(invite.id, invited.id);
    await communityPlacementService.addLeaderAdmin(group.id, promoted.id);
    await communityPlacementService.addLeaderAdmin(group.id, placed.id);

    expect((await fx.announcements()).get(existing.id)).toEqual(
      [placed.id, moved.id, invited.id, promoted.id].sort((a, b) => a - b),
    );
    const leaderNotices = await fx.notifRepo.find({
      where: {
        category: NotificationCategory.MemberJoinedCommunity,
        user: { id: leader.id },
      },
      relations: { associatedUsers: true },
    });
    expect(
      leaderNotices
        .flatMap((notif) => notif.associatedUsers!.map((user) => user.id))
        .sort((a, b) => a - b),
    ).toEqual([placed.id, moved.id, promoted.id].sort((a, b) => a - b));
  });

  it("tells the other leaders, not the promoted leader, when staff add a leader who wasn't a member", async () => {
    const inside = await fx.createUser();
    const outside = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [inside, outside],
      members: [inside],
    });

    await communityPlacementService.addLeaderAdmin(group.id, outside.id);

    const leaderNotices = await fx.notifRepo.find({
      where: { category: NotificationCategory.MemberJoinedCommunity },
      relations: { user: true, associatedUsers: true },
    });
    expect(
      leaderNotices.map((notif) => ({
        to: notif.user!.id,
        about: notif.associatedUsers!.map((user) => user.id),
      })),
    ).toEqual([{ to: inside.id, about: [outside.id] }]);
  });

  it("tells the inviting leader through the acceptance alone, and the other leaders that a member joined", async () => {
    const inviter = await fx.createUser();
    const otherLeader = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [inviter, otherLeader],
      members: [inviter, otherLeader],
    });
    const invited = await fx.createUser();
    const invite = await ctx.dataSource.getRepository(CommunityInvite).save({
      status: CommunityInviteStatus.InviteePending,
      invitingUser: inviter,
      invitedUser: invited,
      community: group,
    });

    await communityInvitesService.acceptCommunityInvite(invite.id, invited.id);

    const categoriesFor = async (user: User) =>
      (await fx.notifRepo.find({ where: { user: { id: user.id } } }))
        .map((notif) => notif.category)
        .sort();
    expect(await categoriesFor(inviter)).toEqual([
      NotificationCategory.CommunityInviteAccepted,
    ]);
    expect(await categoriesFor(otherLeader)).toEqual([
      NotificationCategory.MemberJoinedCommunity,
    ]);
  });

  it("announces a return after contract reinstatement", async () => {
    const existing = await fx.createUser();
    const member = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [],
      members: [existing, member],
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
    expect((await fx.announcements()).get(existing.id)).toEqual([member.id]);
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

    expect(await fx.announcements()).toEqual(
      new Map([[existing.id, [claimant.id]]]),
    );
  });
});

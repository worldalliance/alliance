import type { Repository } from "typeorm";
import { ActionStatsService } from "../src/actions/action-stats.service";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import {
  Action,
  CustomActionStat,
} from "../src/actions/entities/action.entity";
import { AnalyticsModule } from "../src/analytics/analytics.module";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { DailyStatsRecord } from "../src/analytics/dailystats.entity";
import { OnetimeInviteDto } from "../src/user/dto/invite.dto";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("accepted invites (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let inviteRepo: Repository<OnetimeInvite>;

  const createdAt = new Date("2001-06-15T12:00:00Z");
  const windowStart = new Date("2001-06-01T00:00:00Z");
  const windowEnd = new Date("2001-07-01T00:00:00Z");

  beforeAll(async () => {
    ctx = await createTestApp([AnalyticsModule]);
    userRepo = ctx.dataSource.getRepository(User);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("counts only undeleted, claimed invites in every invite stat", async () => {
    const inviter = await userRepo.save(
      userRepo.create({
        name: "Accepted Inviter",
        email: "accepted.inviter@example.com",
        password: "Password123!",
        ambassador: true,
      }),
    );
    const saveInvite = async (params: {
      code: string;
      status: OnetimeInviteStatus;
      claimed: boolean;
      deleted: boolean;
    }) => {
      const invite = await inviteRepo.save(
        inviteRepo.create({
          invitee: params.code,
          code: params.code,
          invitingUser: inviter,
          status: params.status,
        }),
      );
      await inviteRepo.update(invite.id, {
        createdAt,
        deletedAt: params.deleted ? createdAt : null,
      });
      if (!params.claimed) return null;
      return userRepo.save(
        userRepo.create({
          name: `Claimant ${params.code}`,
          email: `claimant.${params.code.toLowerCase()}@example.com`,
          password: "Password123!",
          referredByInvite: invite,
          referralSource: ReferralSource.OnetimeInvite,
        }),
      );
    };
    const claimant = await saveInvite({
      code: "ACCEPTED",
      status: OnetimeInviteStatus.LINK_USED,
      claimed: true,
      deleted: false,
    });
    await saveInvite({
      code: "USED-UNCLAIMED",
      status: OnetimeInviteStatus.LINK_USED,
      claimed: false,
      deleted: false,
    });
    await saveInvite({
      code: "CLAIMED-DELETED",
      status: OnetimeInviteStatus.LINK_USED,
      claimed: true,
      deleted: true,
    });
    await saveInvite({
      code: "UNUSED",
      status: OnetimeInviteStatus.LINK_UNUSED,
      claimed: false,
      deleted: false,
    });

    const userService = ctx.app.get(UserService);
    const overview = await userService.findOnetimeInvitesOverviewForUser(
      inviter.id,
    );
    expect(
      overview
        .map((invite) => new OnetimeInviteDto(invite))
        .filter(({ accepted }) => accepted)
        .map(({ code }) => code),
    ).toEqual(["ACCEPTED"]);

    const memberStats = await userService.getOnetimeInviteMemberStats();
    expect(
      memberStats.find(({ invitingUser }) => invitingUser.id === inviter.id),
    ).toMatchObject({ sent: 3, accepted: 1 });

    const edges = await userService.findOnetimeInviteEdges();
    expect(
      edges.filter(({ invitingUserId }) => invitingUserId === inviter.id),
    ).toEqual([{ invitingUserId: inviter.id, invitedUserId: claimant?.id }]);

    const dashboard = await userService.getAmbassadorInviteDashboard(
      inviter.id,
    );
    expect(dashboard.stats.totalAcceptedInvites).toBe(1);

    const analyticsService = ctx.app.get(AnalyticsService);
    const funnel = await analyticsService.getInviteFunnel(
      windowStart.toISOString(),
      windowEnd.toISOString(),
    );
    expect(funnel.invitesUsed).toBe(1);

    const actionRepo = ctx.dataSource.getRepository(Action);
    const eventRepo = ctx.dataSource.getRepository(ActionEvent);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Invite drive",
        category: [],
        body: "Body",
        shortDescription: "Short",
        customStatType: CustomActionStat.USERS_INVITED,
      }),
    );
    await eventRepo.save([
      eventRepo.create({
        title: "Member phase",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: windowStart,
        action,
      }),
      eventRepo.create({
        title: "Deadline",
        description: "Office phase",
        newStatus: ActionStatus.OfficeAction,
        date: windowEnd,
        action,
      }),
    ]);
    await ctx.app.get(ActionStatsService).computeCustomActionStats(
      await actionRepo.findOneOrFail({
        where: { id: action.id },
        relations: { events: true },
      }),
    );
    expect(
      (await actionRepo.findOneByOrFail({ id: action.id })).customStatValue,
    ).toBe(1);

    const dailyStatsRepo = ctx.dataSource.getRepository(DailyStatsRecord);
    await dailyStatsRepo.clear();
    await analyticsService.calculateDailyStats();
    const [dailyStats] = await dailyStatsRepo.find();
    expect(dailyStats.invitesAccepted).toBe(
      (await analyticsService.getInviteFunnel()).invitesUsed,
    );
  });
});

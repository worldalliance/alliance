import { Temporal } from "@js-temporal/polyfill";
import { milliseconds } from "date-fns";
import { Notification } from "src/notifs/entities/notification.entity";
import { AmbassadorInviteGoalService } from "src/user/ambassador-invite-goal.service";
import { AmbassadorInviteStatsService } from "src/user/ambassador-invite-stats.service";
import { AmbassadorInviteGoal } from "src/user/entities/ambassador-invite-goal.entity";
import { User } from "src/user/entities/user.entity";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

describe("Ambassador invite-goal notifications when two runs overlap (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const at = (offset: Parameters<typeof milliseconds>[0], sign = 1) =>
    new Date(Date.now() + sign * milliseconds(offset));

  async function ambassador(email: string): Promise<User> {
    const userRepo = ctx.dataSource.getRepository(User);
    return userRepo.save(
      userRepo.create({
        name: "Goal Ambassador",
        email,
        password: "Password123!",
        ambassador: true,
        timeZone: "UTC",
        // Outside the goal window, so the midpoint is the send time.
        preferredReminderTime: Temporal.Instant.fromEpochMilliseconds(
          at({ hours: 12 }).getTime(),
        )
          .toZonedDateTimeISO("UTC")
          .toPlainTime(),
      }),
    );
  }

  it.each([
    {
      kind: "halfway",
      window: () => ({
        startAt: at({ minutes: 2 }, -1),
        dueAt: at({ minutes: 1 }),
      }),
    },
    {
      kind: "ended",
      window: () => ({
        startAt: at({ days: 2 }, -1),
        dueAt: at({ minutes: 1 }, -1),
      }),
    },
  ])(
    "sends one $kind notification when two runs both find it unsent",
    async ({ kind, window }) => {
      const owner = await ambassador(`overlap-${kind}@example.com`);
      const goal = await ctx.dataSource
        .getRepository(AmbassadorInviteGoal)
        .save({ ambassador: owner, targetSuccessfulRecruits: 4, ...window() });
      const statsService = ctx.app.get(AmbassadorInviteStatsService);
      const getStats = statsService.getAmbassadorInviteStats.bind(statsService);
      const bothChecked = rendezvous({ parties: 2, timeoutMs: 5000 });
      let checked = 0;
      const stats = jest
        .spyOn(statsService, "getAmbassadorInviteStats")
        .mockImplementation(async (...args) => {
          checked += 1;
          await bothChecked();
          return getStats(...args);
        });

      const service = ctx.app.get(AmbassadorInviteGoalService);
      await Promise.all([
        service.sendDueAmbassadorInviteGoalNotifications(),
        service.sendDueAmbassadorInviteGoalNotifications(),
      ]);
      stats.mockRestore();

      expect(checked).toBe(2);
      expect(
        await ctx.dataSource.getRepository(Notification).countBy({
          groupingKey: `ambassador-invite-goal:${goal.id}:${kind}`,
        }),
      ).toBe(1);
    },
  );
});

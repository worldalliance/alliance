import { getRepositoryToken } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { ActionStatsAnalyticsService } from "src/analytics/action-stats-analytics.service";
import { ActionStatsRecord } from "src/analytics/actionstats.entity";
import { AnalyticsModule } from "src/analytics/analytics.module";
import { AnalyticsService } from "src/analytics/analytics.service";
import { DailyStatsRecord } from "src/analytics/dailystats.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

describe("Analytics crons when two runs overlap (e2e)", () => {
  let ctx: TestContext;
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule, AnalyticsModule]);
    ({ createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await ctx.dataSource.getRepository(ActionStatsRecord).clear();
    await ctx.dataSource.getRepository(DailyStatsRecord).clear();
    await cleanUp();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  function holdAfterFind<T extends object>(
    entity: new () => T,
    release: (call: number) => Promise<void>,
  ) {
    const repo = ctx.app.get<Repository<T>>(getRepositoryToken(entity));
    const find = repo.find.bind(repo);
    let calls = 0;
    jest.spyOn(repo, "find").mockImplementation(async (...args) => {
      const rows = await find(...args);
      calls += 1;
      await release(calls);
      return rows;
    });
  }

  const actionStats = () => ctx.app.get(ActionStatsAnalyticsService);

  it("keeps one daily stats row when two runs both find the day unrecorded", async () => {
    const bothRead = rendezvous({ parties: 2, timeoutMs: 5000 });
    holdAfterFind(User, () => bothRead());

    const analytics = ctx.app.get(AnalyticsService);
    const runs = await Promise.allSettled([
      analytics.calculateDailyStats(),
      analytics.calculateDailyStats(),
    ]);

    expect(runs.map((run) => run.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await ctx.dataSource.getRepository(DailyStatsRecord).count()).toBe(
      1,
    );
  });

  it("finishes every action's stats when two runs both find them unrecorded", async () => {
    const now = new Date();
    const actions = await Promise.all(
      [0, 1].map(() =>
        createAction({ start: addDays(now, -10), deadline: addDays(now, 3) }),
      ),
    );
    const bothRead = rendezvous({ parties: 2, timeoutMs: 5000 });
    holdAfterFind(Action, () => bothRead());

    const runs = await Promise.allSettled([
      actionStats().calculateActionStats(),
      actionStats().calculateActionStats(),
    ]);

    expect(runs.map((run) => run.status)).toEqual(["fulfilled", "fulfilled"]);
    const records = await ctx.dataSource
      .getRepository(ActionStatsRecord)
      .find();
    expect(records.map((record) => record.actionId).sort()).toEqual(
      actions.map((action) => action.id).sort(),
    );
  });

  it("keeps a newer run's action stats when an older run finishes after it", async () => {
    const now = new Date();
    const action = await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, 3),
    });
    await actionStats().calculateActionStats();
    const olderRead = Promise.withResolvers<void>();
    const resumeOlder = Promise.withResolvers<void>();
    holdAfterFind(Action, async (call) => {
      if (call === 1) {
        olderRead.resolve();
        await resumeOlder.promise;
      }
    });

    const older = actionStats().calculateActionStats();
    await olderRead.promise;
    await ctx.dataSource
      .getRepository(Action)
      .update(action.id, { name: "Renamed action" });
    await actionStats().calculateActionStats();
    resumeOlder.resolve();
    await older;

    expect(
      await ctx.dataSource
        .getRepository(ActionStatsRecord)
        .findOneByOrFail({ actionId: action.id }),
    ).toMatchObject({ actionName: "Renamed action" });
  });
});

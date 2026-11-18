import { getRepositoryToken } from "@nestjs/typeorm";
import { AnalyticsModule } from "src/analytics/analytics.module";
import { AnalyticsService } from "src/analytics/analytics.service";
import { DailyStatsRecord } from "src/analytics/dailystats.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

describe("Analytics crons when two runs overlap (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule, AnalyticsModule]);
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await ctx.dataSource.getRepository(DailyStatsRecord).clear();
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
});

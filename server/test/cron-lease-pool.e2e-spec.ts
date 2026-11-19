import { setEnv } from "@alliance/common/set-env";
import { Logger } from "@nestjs/common";
import { ScheduleModule, SchedulerRegistry } from "@nestjs/schedule";
import { AnalyticsModule } from "src/analytics/analytics.module";
import { KoraModule } from "src/kora/kora.module";
import { CronLease } from "src/leases/cron-lease";
import { Lease } from "src/leases/lease.entity";
import { MmsModule } from "src/mms/mms.module";
import { OtpModule } from "src/otp/otp.module";
import { PushModule } from "src/push/push.module";
import { WaitlistModule } from "src/waitlist/waitlist.module";
import { Like } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const POOL_SIZE = 3;

describe("cron jobs on a pool smaller than their number (e2e)", () => {
  let ctx: TestContext;
  let savedSendDevNotifs: string | undefined;

  beforeAll(async () => {
    savedSendDevNotifs = process.env.SEND_DEV_NOTIFS;
    setEnv("SEND_DEV_NOTIFS", "1");
    ctx = await createTestApp(
      [
        ScheduleModule.forRoot(),
        AnalyticsModule,
        KoraModule,
        MmsModule,
        OtpModule,
        PushModule,
        WaitlistModule,
      ],
      { poolSize: POOL_SIZE },
    );
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
    setEnv("SEND_DEV_NOTIFS", savedSendDevNotifs);
  });

  it("completes every job fired at once, each CronLease taken", async () => {
    const leases = ctx.dataSource.getRepository(Lease);
    await leases.delete({ key: Like("cron:%") });
    const jobs = [...ctx.app.get(SchedulerRegistry).getCronJobs().values()];
    await Promise.all(jobs.map((job) => job.stop()));
    expect(jobs.length).toBeGreaterThan(POOL_SIZE * 5);

    for (const job of jobs) job.waitForCompletion = true;
    // @nestjs/schedule catches each job's error and logs it as "Scheduler",
    // so the cron library's errorHandler never sees one.
    const logged = jest.spyOn(Logger.prototype, "error");
    const fired = Promise.all(jobs.map((job) => job.fireOnTick()));
    const outcome = await Promise.race([
      fired.then(() => "completed"),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 20_000)),
    ]);

    const jobErrors = logged.mock.calls.filter(
      (_, i) => Reflect.get(logged.mock.contexts[i], "context") === "Scheduler",
    );
    logged.mockRestore();
    expect(outcome).toBe("completed");
    expect(jobErrors).toEqual([]);
    const taken = await leases.find({ where: { key: Like("cron:%") } });
    expect(taken.map((lease) => lease.key).sort()).toEqual(
      Object.values(CronLease).sort(),
    );
  }, 30_000);
});

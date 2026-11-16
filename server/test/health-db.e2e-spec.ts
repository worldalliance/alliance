import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import pg from "pg";
import { DB_READINESS_TIMEOUT_MS } from "src/health/health.controller";
import { HealthModule } from "src/health/health.module";
import request from "supertest";
import { QueryRunner } from "typeorm";
import { PostgresDriver } from "typeorm/driver/postgres/PostgresDriver";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("GET /health/db (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([HealthModule]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("answers OK when the database answers", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/health/db")
      .expect(200);
    expect(res.body.status).toBe("OK");
  });

  it("fails with 503 when the query fails", async () => {
    const query = spyOn(ctx.dataSource, "query").mockRejectedValueOnce(
      new Error("connection refused"),
    );
    try {
      const res = await request(ctx.app.getHttpServer())
        .get("/health/db")
        .expect(503);
      expect(res.body.message).toBe("Database query failed");
    } finally {
      query.mockRestore();
    }
  });

  it("fails with 503 while every pooled connection is taken", async () => {
    const { driver } = ctx.dataSource;
    if (
      !(driver instanceof PostgresDriver) ||
      !(driver.master instanceof pg.Pool)
    )
      throw new Error("not a pg pool");
    const pool = driver.master;
    const runners: QueryRunner[] = [];
    const connecting: Promise<unknown>[] = [];
    try {
      while (pool.waitingCount === 0) {
        const runner = ctx.dataSource.createQueryRunner();
        runners.push(runner);
        connecting.push(runner.connect());
        // pg-pool counts a request for an idle client as waiting until its next tick.
        await Bun.sleep(0);
      }

      const started = performance.now();
      const res = await request(ctx.app.getHttpServer())
        .get("/health/db")
        .expect(503);
      expect(res.body.message).toBe("Database timed out");
      expect(performance.now() - started).toBeGreaterThanOrEqual(
        DB_READINESS_TIMEOUT_MS - 50,
      );
    } finally {
      for (const [i, runner] of runners.entries()) {
        await connecting[i];
        await runner.release();
      }
    }
  });
});

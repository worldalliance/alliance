import type { DataSource, QueryRunner } from "typeorm";
import {
  withPgAdvisoryLock,
  withPgSessionLock,
} from "../src/notifs/lock-utils";
import { createTestApp, TestContext } from "./e2e-test-utils";

const KEY = [918273, 1] as const;

describe("withPgSessionLock (e2e)", () => {
  let ctx: TestContext;
  let dataSource: DataSource;

  const withLock = <T>(fn: Parameters<typeof withPgSessionLock<T>>[3]) =>
    withPgSessionLock(dataSource, ...KEY, fn);

  // Asks pg_locks rather than trying the lock, which a pooled connection still
  // holding it would be granted again.
  const lockIsFree = async (): Promise<boolean> => {
    const [{ held }] = await dataSource.query(
      `SELECT count(*)::int AS held FROM pg_locks
       WHERE locktype = 'advisory' AND classid = $1 AND objid = $2 AND objsubid = 2
         AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`,
      [...KEY],
    );
    return held === 0;
  };

  const probeRows = async (): Promise<number> => {
    const [{ count }] = await dataSource.query(
      "SELECT count(*)::int AS count FROM lock_utils_probe",
    );
    return count;
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    dataSource = ctx.dataSource;
    await dataSource.query(
      "CREATE TABLE IF NOT EXISTS lock_utils_probe (id int)",
    );
  }, 50000);

  beforeEach(async () => {
    await dataSource.query("DELETE FROM lock_utils_probe");
  });

  afterAll(async () => {
    await dataSource.query("DROP TABLE lock_utils_probe");
    await ctx.app.close();
  });

  it("runs outside a transaction while holding the lock, then releases it", async () => {
    const seen = await withLock(async (qr) => ({
      inTransaction: qr.isTransactionActive,
      free: await lockIsFree(),
    }));
    expect(seen).toEqual({ inTransaction: false, free: false });
    expect(await lockIsFree()).toBe(true);
  });

  it("resolves to null without running while another session holds the lock", async () => {
    const holder = dataSource.createQueryRunner();
    await holder.connect();
    await holder.query("SELECT pg_advisory_lock($1, $2)", [...KEY]);
    try {
      let ran = false;
      expect(
        await withLock(async () => {
          ran = true;
        }),
      ).toBeNull();
      expect(ran).toBe(false);
    } finally {
      await holder.query("SELECT pg_advisory_unlock($1, $2)", [...KEY]);
      await holder.release();
    }
  });

  it("rethrows and releases the lock when the function throws", async () => {
    await expect(
      withLock(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await lockIsFree()).toBe(true);
  });

  it("rolls back nested transactions the function left open, then releases the lock", async () => {
    let runner: QueryRunner | undefined;
    await expect(
      withLock(async (qr) => {
        runner = qr;
        await qr.startTransaction();
        await qr.startTransaction();
        await qr.query("SELECT 1/0");
      }),
    ).rejects.toThrow("division by zero");
    expect(runner?.isTransactionActive).toBe(false);
    expect(await lockIsFree()).toBe(true);
  });

  it("rejects, rolls back, and unlocks when the function resolves with a transaction open", async () => {
    await expect(
      withLock(async (qr) => {
        await qr.startTransaction();
        await qr.query("INSERT INTO lock_utils_probe VALUES (1)");
      }),
    ).rejects.toThrow("left a transaction open");
    expect(await probeRows()).toBe(0);
    expect(await lockIsFree()).toBe(true);
  });

  it("unlocks even when rolling back the function's transaction fails", async () => {
    await expect(
      withLock(async (qr) => {
        await qr.startTransaction();
        const rollback = qr.rollbackTransaction.bind(qr);
        qr.rollbackTransaction = async () => {
          await rollback();
          throw new Error("rollback failed");
        };
      }),
    ).rejects.toThrow("rollback failed");
    expect(await lockIsFree()).toBe(true);
  });

  it("commits withPgAdvisoryLock's transaction when the function resolves", async () => {
    await withPgAdvisoryLock(dataSource, ...KEY, async (qr) => {
      await qr.query("INSERT INTO lock_utils_probe VALUES (1)");
    });
    expect(await probeRows()).toBe(1);
    expect(await lockIsFree()).toBe(true);
  });

  it("rolls back withPgAdvisoryLock's transaction when the function throws", async () => {
    await expect(
      withPgAdvisoryLock(dataSource, ...KEY, async (qr) => {
        await qr.query("INSERT INTO lock_utils_probe VALUES (1)");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await probeRows()).toBe(0);
    expect(await lockIsFree()).toBe(true);
  });
});

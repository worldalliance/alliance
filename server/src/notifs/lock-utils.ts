import { DataSource, QueryRunner } from "typeorm";

/**
 * Runs `fn` while holding a session advisory lock, on the lock's own
 * connection. Rolls back any transaction `fn` leaves open, and rejects if `fn`
 * resolved with one open. Resolves to null without running it when another
 * session holds the lock.
 */
export async function withPgSessionLock<T>(
  dataSource: DataSource,
  lockKey1: number,
  lockKey2: number,
  fn: (qr: QueryRunner) => Promise<T>,
): Promise<T | null> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();

  try {
    const [{ pg_try_advisory_lock }] = await qr.query(
      "SELECT pg_try_advisory_lock($1, $2) AS pg_try_advisory_lock",
      [lockKey1, lockKey2],
    );

    if (!pg_try_advisory_lock) {
      return null;
    }

    try {
      const result = await fn(qr);
      if (qr.isTransactionActive) {
        throw new Error("withPgSessionLock: fn left a transaction open");
      }
      return result;
    } finally {
      try {
        while (qr.isTransactionActive) await qr.rollbackTransaction();
      } finally {
        await qr.query("SELECT pg_advisory_unlock($1, $2)", [
          lockKey1,
          lockKey2,
        ]);
      }
    }
  } finally {
    await qr.release();
  }
}

export function withPgAdvisoryLock<T>(
  dataSource: DataSource,
  lockKey1: number,
  lockKey2: number,
  fn: (qr: QueryRunner) => Promise<T>,
): Promise<T | null> {
  return withPgSessionLock(dataSource, lockKey1, lockKey2, async (qr) => {
    await qr.startTransaction();
    const result = await fn(qr);
    await qr.commitTransaction();
    return result;
  });
}

import { DataSource, QueryRunner } from "typeorm";

export async function withPgAdvisoryLock<T>(
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

    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.query("SELECT pg_advisory_unlock($1, $2)", [lockKey1, lockKey2]);
    }
  } finally {
    await qr.release();
  }
}

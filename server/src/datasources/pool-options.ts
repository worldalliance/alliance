import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export const poolOptions = {
  // Each lock-taking cron in LOCK_KEYS holds one connection for its lock and
  // takes a second for its queries, so a pool no larger than their number
  // deadlocks when they fire together.
  poolSize: 30,
  // A query that can't get a connection fails instead of waiting forever.
  connectTimeoutMS: 10_000,
} satisfies Pick<PostgresConnectionOptions, "poolSize" | "connectTimeoutMS">;

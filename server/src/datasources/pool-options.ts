import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export const poolOptions = {
  // Fired together, the lock-taking crons in LOCK_KEYS each hold connections
  // (their lock's plus their job's parallel queries) while waiting for one more.
  // A pool no larger than that sum, which pool-options.spec.ts computes, can
  // deadlock; HTTP requests and the unlocked crons share what is left.
  // Decision 5 in docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.
  poolSize: 30,
  // A query that can't get a connection fails instead of waiting forever.
  connectTimeoutMS: 10_000,
} satisfies Pick<PostgresConnectionOptions, "poolSize" | "connectTimeoutMS">;

import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export const poolOptions = {
  // Not yet sized from measured pool use: ALL-2369.
  poolSize: 30,
  // A query that can't get a connection fails instead of waiting forever.
  connectTimeoutMS: 10_000,
} satisfies Pick<PostgresConnectionOptions, "poolSize" | "connectTimeoutMS">;

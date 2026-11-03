import "dotenv/config";

import { NodeEnv } from "@alliance/common/node-env";
import { env, requireEnv } from "../config/env";

import {
  assertWorktreeDatabase,
  DevDatabase,
  devPorts,
  PortCaller,
} from "@alliance/common/dev-ports";
import { DataSource } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { AppTypeOrmLogger } from "../utils/typeorm-logger";

export const connectionOptions = (): PostgresConnectionOptions => {
  // The TypeORM CLI bypasses main.ts, and dotenv preserves an exported DB_NAME.
  assertWorktreeDatabase({
    ports: devPorts(PortCaller.Server),
    which: DevDatabase.Dev,
    actual: env("DB_NAME"),
  });

  const shared: PostgresConnectionOptions = {
    type: "postgres",
    host: env("DB_HOST"),
    port: env("DB_PORT"),
    username: env("DB_USERNAME"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    useUTC: true,
    maxQueryExecutionTime: 100,
    logging: ["error", "warn"],
    logger: new AppTypeOrmLogger(),
  };

  return env("NODE_ENV") === NodeEnv.Production ||
    env("NODE_ENV") === NodeEnv.Staging
    ? {
        ...shared,
        ssl: {
          rejectUnauthorized: true,
          ca: requireEnv("DB_CA_CERT"),
        },
        extra: {
          ssl: { rejectUnauthorized: true, ca: requireEnv("DB_CA_CERT") },
        },
      }
    : {
        ...shared,
      };
};

/**
 * The DataSource the TypeORM CLI uses — `migration:run`, `migration:generate`
 * and `schema:log` all point at this file.
 *
 * `entities` is only needed here: the app registers its entities through
 * `TypeOrmModule.forFeature` and `autoLoadEntities`, so `connectionOptions()`
 * above deliberately has none. The CLI has no Nest container to learn them
 * from, and without them it cannot diff entities against the schema
 * (`migration:generate` and the drift check both go silent) nor create
 * TypeORM's `typeorm_metadata` table when a view or generated column needs it.
 */
const dataSource = new DataSource({
  ...connectionOptions(),
  entities: ["src/**/*.entity.ts"],
  logger: undefined,
  migrations: ["migrations/*{.ts,.js}"],
});
export default dataSource;

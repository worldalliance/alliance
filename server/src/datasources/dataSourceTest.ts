import { assertNotDevDatabase } from "@alliance/common/dev-database";
import {
  assertWorktreeDatabase,
  DevDatabase,
  devPorts,
  PortCaller,
} from "@alliance/common/dev-ports";
import { NodeEnv } from "@alliance/common/node-env";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import path from "node:path";
import { env } from "../config/env";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

export const testConnectionOptions = (): TypeOrmModuleOptions => {
  if (env("NODE_ENV") !== NodeEnv.Test) {
    throw new Error(
      `testConnectionOptions() requires NODE_ENV=${NodeEnv.Test}, got ${env("NODE_ENV")} — refusing to run dropSchema against a database resolved without server/.env.test`,
    );
  }

  const database = env("TEST_DB_NAME") ?? env("DB_NAME");

  assertNotDevDatabase({
    repoRoot,
    database,
    action: "run dropSchema against",
    recovery:
      "DB_NAME is exported in your shell, where it outranks server/.env.test — unset it, or set TEST_DB_NAME to a throwaway database.",
  });

  assertWorktreeDatabase({
    ports: devPorts(PortCaller.Server),
    which: DevDatabase.Test,
    actual: database,
  });

  return {
    type: "postgres",
    host: env("DB_HOST"),
    port: 5432,
    entities: ["src/**/*.entity{.ts,.js}"],
    username: env("DB_USERNAME"),
    password: env("DB_PASSWORD"),
    database,
    autoLoadEntities: true,
    synchronize: true,
    dropSchema: true,
  };
};

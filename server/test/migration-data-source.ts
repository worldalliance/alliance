import { readdirSync } from "node:fs";
import path from "node:path";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import { DataSource, type DataSourceOptions } from "typeorm";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

export const migrationFiles = (keep: (timestamp: number) => boolean) =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+-.+\.ts$/.test(file) && keep(parseInt(file, 10)))
    .map((file) => path.join(MIGRATIONS_DIR, file));

export function dataSourceFor(params: {
  migrations: NonNullable<DataSourceOptions["migrations"]>;
  dropSchema: boolean;
}): DataSource {
  const options = testConnectionOptions();
  if (options.type !== "postgres") {
    throw new Error(`expected postgres test options, got ${options.type}`);
  }
  const { host, port, username, password, database } = options;
  return new DataSource({
    type: "postgres",
    host,
    port,
    username,
    password,
    database,
    useUTC: true,
    dropSchema: params.dropSchema,
    // Lets TypeORM create typeorm_metadata, which a generated-column migration writes to.
    entities: ["src/**/*.entity.ts"],
    migrations: params.migrations,
  } satisfies DataSourceOptions);
}

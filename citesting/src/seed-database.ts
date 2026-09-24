import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { screenshotDatabase } from "./screenshot-database";

const repoRoot = path.resolve(__dirname, "..", "..");

// The dump's own date; every timestamp moves forward by NOW() minus this so
// relative times and deadlines look the same whenever it loads.
const SEED_REFERENCE_DATE = "2026-02-10T18:00:00Z";

export const dbHost = process.env.DB_HOST ?? "localhost";
export const dbPort = process.env.DB_PORT ?? "5432";
export const dbUser = process.env.DB_USERNAME ?? "postgres";
export const dbPass = process.env.DB_PASSWORD ?? "postgres";

const psqlBase = ["-h", dbHost, "-p", dbPort, "-U", dbUser];
const pgEnv: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: dbPass };

type OnSpawn = (child: ChildProcess) => void;

const run = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdin?: string;
    onSpawn?: OnSpawn;
  },
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [
        options.stdin === undefined ? "inherit" : "pipe",
        "inherit",
        "inherit",
      ],
    });
    options.onSpawn?.(child);

    if (options.stdin !== undefined) child.stdin?.end(options.stdin);

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });

const psql = ({
  database,
  args,
  stdin,
  onSpawn,
}: {
  database: string;
  args: string[];
  stdin?: string;
  onSpawn?: OnSpawn;
}) =>
  run("psql", [...psqlBase, "-d", database, ...args], {
    cwd: repoRoot,
    env: pgEnv,
    stdin,
    onSpawn,
  });

const loadSeedData = async (database: string, onSpawn?: OnSpawn) => {
  const seedFile = path.join(
    repoRoot,
    "citesting",
    "fixtures",
    "seed_dataonly.sql",
  );
  const seedContent = (await fs.readFile(seedFile, "utf8"))
    .split("\n")
    // pg17-only constructs, stripped so the dump loads on older Postgres.
    .filter(
      (line) =>
        !/^SET\s+transaction_timeout\s*=/i.test(line) &&
        !/^\\restrict\b/.test(line) &&
        !/^\\unrestrict\b/.test(line),
    )
    .join("\n");

  // replica disables FK triggers, so row order doesn't matter and circular
  // FKs such as comment → comment load.
  await psql({
    database,
    args: ["-v", "ON_ERROR_STOP=1"],
    onSpawn,
    stdin: `SET session_replication_role = 'replica';\n${seedContent}\nSET session_replication_role = 'origin';\n`,
  });
};

const shiftTimestamps = (database: string, onSpawn?: OnSpawn) =>
  psql({
    database,
    onSpawn,
    args: [
      "-c",
      `
    DO $$
    DECLARE
      r RECORD;
      delta INTERVAL := NOW() - '${SEED_REFERENCE_DATE}'::timestamptz;
    BEGIN
      FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('timestamp with time zone',
                            'timestamp without time zone')
      LOOP
        EXECUTE format(
          'UPDATE %I SET %I = %I + $1 WHERE %I IS NOT NULL',
          r.table_name, r.column_name, r.column_name, r.column_name
        ) USING delta;
      END LOOP;
    END
    $$;
  `,
    ],
  });

/**
 * Drops and recreates the screenshot database, migrates it, and loads the
 * shifted seed. `onSpawn` receives each child so the caller's shutdown can
 * kill it.
 */
export const seedDatabase = async ({
  logPrefix,
  onSpawn,
}: {
  logPrefix: string;
  onSpawn?: OnSpawn;
}) => {
  const database = screenshotDatabase();
  console.log(`${logPrefix} Setting up database "${database}"...`);
  await psql({
    database: "postgres",
    args: ["-c", `DROP DATABASE IF EXISTS "${database}"`],
    onSpawn,
  });
  await psql({
    database: "postgres",
    args: ["-c", `CREATE DATABASE "${database}"`],
    onSpawn,
  });

  console.log(`${logPrefix} Running migrations...`);
  await run(
    "bunx",
    [
      "typeorm-ts-node-commonjs",
      "--dataSource",
      "src/datasources/dataSource.ts",
      "migration:run",
    ],
    {
      cwd: path.join(repoRoot, "server"),
      env: {
        ...process.env,
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_USERNAME: dbUser,
        DB_PASSWORD: dbPass,
        DB_NAME: database,
        NODE_ENV: "test",
      },
      onSpawn,
    },
  );

  console.log(`${logPrefix} Loading seed dump...`);
  await loadSeedData(database, onSpawn);

  console.log(`${logPrefix} Shifting timestamps to current date...`);
  await shiftTimestamps(database, onSpawn);
};

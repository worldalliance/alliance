import { readdirSync } from "node:fs";
import path from "node:path";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import {
  DataSource,
  type DataSourceOptions,
  type MigrationInterface,
  type QueryRunner,
} from "typeorm";
import {
  REMOVAL_MIGRATION,
  RemovalState,
  removalState,
  revertRemoval,
} from "../scripts/lib/streak-recognition-removal";
import { waitForLockWait } from "./e2e-test-utils";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const REMOVAL_TIMESTAMP = 1791471025174;

const migrationFiles = (keep: (timestamp: number) => boolean) =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+-.+\.ts$/.test(file) && keep(parseInt(file, 10)))
    .map((file) => path.join(MIGRATIONS_DIR, file));

function dataSourceFor(params: {
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

const STREAK_COLUMNS = [
  "reminder_group.streakRecognition",
  "action_suite.onboarding",
  "action_event_notif.streakCount",
  "action_event_notif.streakRunSuiteId",
  "action_event_notif.streakRecognitionCopy",
];

describe("RemoveStreakRecognition migration (e2e)", () => {
  let removal: DataSource;

  const query = <T>(sql: string, params?: unknown[]): Promise<T[]> =>
    removal.query(sql, params);

  const presentStreakColumns = async () =>
    (
      await query<{ column: string }>(
        `SELECT table_name || '.' || column_name AS "column" FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name || '.' || column_name = ANY($1)
         ORDER BY 1`,
        [STREAK_COLUMNS],
      )
    ).map((row) => row.column);

  const experimentValues = async () =>
    (
      await query<{ value: string }>(
        `SELECT unnest(enum_range(NULL::"Experiment"))::text AS "value"`,
      )
    ).map((row) => row.value);

  const indexExists = async (name: string) =>
    (await query(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [name]))
      .length > 0;

  const count = async (table: string) =>
    (await query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`))[0]
      .n;

  const streakUsage = () =>
    query(
      `SELECT (SELECT count(*) FROM "reminder_group" WHERE "streakRecognition")::int AS "groups",
              (SELECT count(*) FROM "experiment_assignment")::int AS "assignments",
              (SELECT count(*) FROM "action_event_notif" WHERE "streakCount" IS NOT NULL
                 OR "streakRunSuiteId" IS NOT NULL OR "streakRecognitionCopy" IS NOT NULL)::int AS "notifs"`,
    );

  const seed = async () => {
    const [user] = await query<{ id: number }>(
      `INSERT INTO "user" ("name", "email", "referralCode")
       VALUES ('Sam Example', 'sam@example.com', 'ref-sam') RETURNING "id"`,
    );
    const [action] = await query<{ id: number }>(
      `INSERT INTO "action" ("name", "body", "onboarding") VALUES ('Welcome', 'body', true) RETURNING "id"`,
    );
    const [event] = await query<{ id: number }>(
      `INSERT INTO "action_event" ("title", "description", "date", "actionId")
       VALUES ('Due', 'due', now(), $1) RETURNING "id"`,
      [action.id],
    );
    const [suite] = await query<{ id: number }>(
      `INSERT INTO "action_suite" ("name") VALUES ('Onboarding') RETURNING "id"`,
    );
    await query(`UPDATE "action_suite" SET "onboarding" = true`);
    const [group] = await query<{ id: number }>(
      `INSERT INTO "reminder_group" ("name", "emailMessage", "emailSubject", "textMessage", "memberActionEventId", "timingMode")
       VALUES ('Two Day Range', 'message', 'subject', 'text', $1, 'event_launch') RETURNING "id"`,
      [event.id],
    );
    const [notif] = await query<{ id: number }>(
      `INSERT INTO "action_event_notif" ("userId", "type", "reminderGroupId", "actionSuiteId", "missNumber", "sent")
       VALUES ($1, 'misseddeadline', $2, $3, 1, true) RETURNING "id"`,
      [user.id, group.id, suite.id],
    );
    await query(
      `INSERT INTO "experiment_assignment" ("userId", "experiment", "arm")
       VALUES ($1, 'missed_suite_first_notice', 'variant')`,
      [user.id],
    );
    return { userId: user.id, groupId: group.id, notifId: notif.id };
  };

  const clearData = () =>
    query(`TRUNCATE "user", "action", "action_suite" RESTART IDENTITY CASCADE`);

  beforeAll(async () => {
    const before = dataSourceFor({
      migrations: migrationFiles((t) => t < REMOVAL_TIMESTAMP),
      dropSchema: true,
    });
    await before.initialize();
    await before.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await before.runMigrations({ transaction: "all" });
    await before.destroy();

    removal = dataSourceFor({
      migrations: migrationFiles((t) => t === REMOVAL_TIMESTAMP),
      dropSchema: false,
    });
    await removal.initialize();
  }, 300000);

  afterEach(async () => {
    if ((await removalState(removal)) === RemovalState.Applied) {
      await removal.undoLastMigration({ transaction: "all" });
    }
    await clearData();
  });

  afterAll(async () => {
    await removal.destroy();
  });

  it("drops the feature schema and keeps unrelated records and constraints", async () => {
    const { userId } = await seed();

    await removal.runMigrations({ transaction: "all" });

    expect(await removalState(removal)).toBe(RemovalState.Applied);
    expect(await presentStreakColumns()).toEqual([]);
    expect(await experimentValues()).toEqual([
      "missed_suite_first_notice",
      "action_update_recognition",
    ]);
    expect(
      await query(
        `SELECT 1 FROM pg_type WHERE typname = 'StreakRecognitionCopy'`,
      ),
    ).toEqual([]);
    expect(await indexExists("IDX_be75e72540f89ecdd0a7d225ef")).toBe(false);

    for (const table of [
      "user",
      "action",
      "action_suite",
      "reminder_group",
      "action_event_notif",
      "experiment_assignment",
    ]) {
      expect(await count(table)).toBe(1);
    }
    expect(await query(`SELECT "onboarding" FROM "action"`)).toEqual([
      { onboarding: true },
    ]);
    expect(
      await query(
        `SELECT "missNumber", "actionSuiteId" IS NOT NULL AS "hasSuite" FROM "action_event_notif"`,
      ),
    ).toEqual([{ missNumber: 1, hasSuite: true }]);
    await expect(
      query(
        `INSERT INTO "experiment_assignment" ("userId", "experiment", "arm")
         VALUES ($1, 'missed_suite_first_notice', 'control')`,
        [userId],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  const blockers: [
    string,
    (ids: Awaited<ReturnType<typeof seed>>) => Promise<unknown>,
  ][] = [
    [
      "an enabled reminder group",
      ({ groupId }) =>
        query(
          `UPDATE "reminder_group" SET "streakRecognition" = true WHERE "id" = $1`,
          [groupId],
        ),
    ],
    [
      "an enabled reminder group marked all sent",
      ({ groupId }) =>
        query(
          `UPDATE "reminder_group" SET "streakRecognition" = true, "allSent" = true WHERE "id" = $1`,
          [groupId],
        ),
    ],
    ...(["control", "variant"] as const).map(
      (arm): (typeof blockers)[number] => [
        `a ${arm} streak assignment`,
        ({ userId }) =>
          query(
            `INSERT INTO "experiment_assignment" ("userId", "experiment", "arm")
             VALUES ($1, 'streak_recognition', $2)`,
            [userId, arm],
          ),
      ],
    ),
    ...[
      `"streakCount" = 2`,
      `"streakRunSuiteId" = 1`,
      `"streakRecognitionCopy" = 'control'`,
    ].map((assignment): (typeof blockers)[number] => [
      `an unsent notif with ${assignment}`,
      ({ notifId }) =>
        query(
          `UPDATE "action_event_notif" SET ${assignment}, "sent" = false WHERE "id" = $1`,
          [notifId],
        ),
    ]),
  ];

  it.each(blockers)(
    "refuses to run with %s, leaving schema and data as they were",
    async (_, block) => {
      await block(await seed());
      const usageBefore = await streakUsage();

      await expect(
        removal.runMigrations({ transaction: "all" }),
      ).rejects.toThrow(/Streak recognition is still in use/);

      expect(await removalState(removal)).toBe(RemovalState.Pending);
      expect(await presentStreakColumns()).toEqual([...STREAK_COLUMNS].sort());
      expect(await experimentValues()).toContain("streak_recognition");
      expect(await indexExists("IDX_be75e72540f89ecdd0a7d225ef")).toBe(true);
      expect(await streakUsage()).toEqual(usageBefore);
    },
  );

  it("waits out a concurrent writer and then sees what it committed", async () => {
    const { groupId } = await seed();
    const writer = removal.createQueryRunner();
    await writer.startTransaction();
    try {
      await writer.query(
        `UPDATE "reminder_group" SET "streakRecognition" = true WHERE "id" = $1`,
        [groupId],
      );
      const migrating = removal.runMigrations({ transaction: "all" });
      const settled = migrating.then(
        () => null,
        (error: unknown) => error,
      );
      await waitForLockWait(removal);
      await writer.commitTransaction();
      expect(String(await settled)).toMatch(
        /Streak recognition is still in use/,
      );
    } finally {
      await writer.release();
    }
    expect(await removalState(removal)).toBe(RemovalState.Pending);
  });

  it("refuses to run outside a transaction", async () => {
    await expect(
      removal.runMigrations({ transaction: "none" }),
    ).rejects.toThrow(/LOCK TABLE can only be used in transaction blocks/);
    expect(await presentStreakColumns()).toEqual([...STREAK_COLUMNS].sort());
  });

  it("removalState is pending until the release's removal runs, and absent from a release without it", async () => {
    expect(await removalState(removal)).toBe(RemovalState.Pending);

    const without = dataSourceFor({ migrations: [], dropSchema: false });
    await without.initialize();
    try {
      expect(await removalState(without)).toBe(RemovalState.Absent);
    } finally {
      await without.destroy();
    }
  });

  it("revertRemoval restores the feature schema and its bookkeeping, so the removal reruns", async () => {
    const { userId, groupId } = await seed();
    await removal.runMigrations({ transaction: "all" });

    await revertRemoval(removal);

    expect(await removalState(removal)).toBe(RemovalState.Pending);
    expect(await presentStreakColumns()).toEqual([...STREAK_COLUMNS].sort());
    expect(await indexExists("IDX_be75e72540f89ecdd0a7d225ef")).toBe(true);
    expect(await query(`SELECT "onboarding" FROM "action_suite"`)).toEqual([
      { onboarding: true },
    ]);
    expect(
      await query(
        `SELECT "streakRecognition" FROM "reminder_group" WHERE "id" = $1`,
        [groupId],
      ),
    ).toEqual([{ streakRecognition: false }]);
    await query(
      `INSERT INTO "experiment_assignment" ("userId", "experiment", "arm")
       VALUES ($1, 'streak_recognition', 'control')`,
      [userId],
    );
    await query(
      `DELETE FROM "experiment_assignment" WHERE "experiment" = 'streak_recognition'`,
    );

    await removal.runMigrations({ transaction: "all" });
    expect(await removalState(removal)).toBe(RemovalState.Applied);
  });

  it("revertRemoval also undoes a migration the same deploy applied after the removal", async () => {
    class Later1799999999999 implements MigrationInterface {
      name = "Later1799999999999";
      async up(queryRunner: QueryRunner) {
        await queryRunner.query(`CREATE TABLE "later_marker" ("id" int)`);
      }
      async down(queryRunner: QueryRunner) {
        await queryRunner.query(`DROP TABLE "later_marker"`);
      }
    }
    const batched = dataSourceFor({
      migrations: [
        ...migrationFiles((t) => t === REMOVAL_TIMESTAMP),
        Later1799999999999,
      ],
      dropSchema: false,
    });
    await batched.initialize();
    try {
      await batched.runMigrations({ transaction: "all" });
      expect(await presentStreakColumns()).toEqual([]);

      await revertRemoval(batched);

      expect(await removalState(batched)).toBe(RemovalState.Pending);
      expect(await presentStreakColumns()).toEqual([...STREAK_COLUMNS].sort());
      expect(
        await query(
          `SELECT 1 FROM "migrations" WHERE "name" = 'Later1799999999999'`,
        ),
      ).toEqual([]);
      expect(
        await query(`SELECT to_regclass('later_marker') AS "table"`),
      ).toEqual([{ table: null }]);
    } finally {
      await batched.destroy();
    }
  });

  it("revertRemoval refuses when the removal isn't recorded", async () => {
    await expect(revertRemoval(removal)).rejects.toThrow(
      `${REMOVAL_MIGRATION} is not recorded; refusing to revert`,
    );
    expect(await presentStreakColumns()).toEqual([...STREAK_COLUMNS].sort());
  });
});

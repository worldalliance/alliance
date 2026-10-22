import type { DataSource } from "typeorm";

export const REMOVAL_MIGRATION = "RemoveStreakRecognition1791471025174";

const FEATURE_COLUMNS = [
  ["reminder_group", "streakRecognition"],
  ["action_suite", "onboarding"],
  ["action_event_notif", "streakCount"],
  ["action_event_notif", "streakRunSuiteId"],
  ["action_event_notif", "streakRecognitionCopy"],
] as const;

export enum RemovalState {
  Absent = "absent",
  Applied = "applied",
  Pending = "pending",
}

export async function removalState(
  dataSource: DataSource,
): Promise<RemovalState> {
  if (
    !dataSource.migrations.some(
      (migration) =>
        (migration.name ?? migration.constructor.name) === REMOVAL_MIGRATION,
    )
  ) {
    return RemovalState.Absent;
  }
  const rows: unknown[] = await dataSource.query(
    `SELECT 1 FROM "migrations" WHERE "name" = $1`,
    [REMOVAL_MIGRATION],
  );
  return rows.length > 0 ? RemovalState.Applied : RemovalState.Pending;
}

/**
 * Undoes the removal and every migration recorded after it, newest first:
 * under the deploy's lock, with the removal pending when it began, those are
 * what that deploy applied. Throws unless the streak columns are back.
 */
export async function revertRemoval(dataSource: DataSource): Promise<void> {
  const [{ count }]: { count: number }[] = await dataSource.query(
    `SELECT count(*)::int AS "count" FROM "migrations"
     WHERE "id" >= (SELECT "id" FROM "migrations" WHERE "name" = $1)`,
    [REMOVAL_MIGRATION],
  );
  if (count === 0) {
    throw new Error(`${REMOVAL_MIGRATION} is not recorded; refusing to revert`);
  }
  for (let undone = 0; undone < count; undone++) {
    await dataSource.undoLastMigration({ transaction: "all" });
  }

  if ((await removalState(dataSource)) !== RemovalState.Pending) {
    throw new Error(`${REMOVAL_MIGRATION} is still recorded after its revert`);
  }
  const present: { table_name: string; column_name: string }[] =
    await dataSource.query(
      `SELECT "table_name", "column_name" FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND ("table_name", "column_name") IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
      [
        FEATURE_COLUMNS.map(([table]) => table),
        FEATURE_COLUMNS.map(([, column]) => column),
      ],
    );
  const missing = FEATURE_COLUMNS.filter(
    ([table, column]) =>
      !present.some(
        (row) => row.table_name === table && row.column_name === column,
      ),
  );
  if (missing.length > 0) {
    throw new Error(
      `the old release's columns are still missing after the revert: ${missing.map(([table, column]) => `${table}.${column}`).join(", ")}`,
    );
  }
}

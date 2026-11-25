import type { DataSource } from "typeorm";
import { dataSourceFor, migrationFiles } from "./migration-data-source";

const LAUNCH_CUTOFF_TIMESTAMP = 1794961449435;
const TWILIO_NUMBER = "+15550001111";

describe("MmsThreadLaunchCutoff migration (e2e)", () => {
  let migration: DataSource;

  const query = <T>(sql: string, params?: unknown[]): Promise<T[]> =>
    migration.query(sql, params);

  const member = (params: { phoneNumber: string; deleted: boolean }) =>
    query(
      `INSERT INTO "user" ("name", "email", "referralCode", "phoneNumber", "deletedAt")
       VALUES ('Sam Example', $1, $2, $3, $4)`,
      [
        `${params.phoneNumber}@example.com`,
        `ref-${params.phoneNumber}`,
        params.phoneNumber,
        params.deleted ? new Date() : null,
      ],
    );

  const inboundTexts = async (phoneNumber: string): Promise<number[]> => {
    await query(`INSERT INTO "mms_thread" ("phoneNumber") VALUES ($1)`, [
      phoneNumber,
    ]);
    const rows = await query<{ id: number }>(
      `INSERT INTO "mms" ("to", "from", "body", "direction", "status", "twilioSid", "createdAt")
       VALUES ($1, $2, 'older', 'inbound', 'received', $3, '2026-01-01'),
              ($1, $2, 'newer', 'inbound', 'received', $4, '2026-01-02')
       RETURNING "id"`,
      [TWILIO_NUMBER, phoneNumber, `${phoneNumber}-1`, `${phoneNumber}-2`],
    );
    return rows.map((row) => row.id);
  };

  const cutoffs = async () =>
    Object.fromEntries(
      (
        await query<{ phoneNumber: string; launchCutoffId: number | null }>(
          `SELECT "phoneNumber", "launchCutoffId" FROM "mms_thread"`,
        )
      ).map((row) => [row.phoneNumber, row.launchCutoffId]),
    );

  beforeAll(async () => {
    const before = dataSourceFor({
      migrations: migrationFiles((t) => t < LAUNCH_CUTOFF_TIMESTAMP),
      dropSchema: true,
    });
    await before.initialize();
    await before.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await before.runMigrations({ transaction: "all" });
    await before.destroy();

    migration = dataSourceFor({
      migrations: migrationFiles((t) => t === LAUNCH_CUTOFF_TIMESTAMP),
      dropSchema: false,
    });
    await migration.initialize();
  }, 300000);

  afterAll(async () => {
    await migration.destroy();
  });

  it("cuts off at the newest text of numbers no live member holds", async () => {
    const [, nonMemberNewest] = await inboundTexts("+14155550101");
    await member({ phoneNumber: "+14155550102", deleted: false });
    await inboundTexts("+14155550102");
    await member({ phoneNumber: "+14155550103", deleted: true });
    const [, deletedNewest] = await inboundTexts("+14155550103");

    await migration.runMigrations({ transaction: "all" });

    expect(await cutoffs()).toEqual({
      "+14155550101": nonMemberNewest,
      "+14155550102": null,
      "+14155550103": deletedNewest,
    });
  });
});

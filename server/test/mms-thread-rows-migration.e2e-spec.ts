import { MmsDirection } from "src/mms/mms.entity";
import type { DataSource } from "typeorm";
import { dataSourceFor, migrationFiles } from "./migration-data-source";

const THREAD_ROWS_TIMESTAMP = 1794895000001;
const TWILIO_NUMBER = "+15550001111";

describe("MmsThreadRows migration (e2e)", () => {
  let migration: DataSource;

  const query = <T>(sql: string, params?: unknown[]): Promise<T[]> =>
    migration.query(sql, params);

  const text = async (params: {
    phoneNumber: string;
    direction: MmsDirection;
    sentById: number | null;
  }) => {
    const { phoneNumber, direction, sentById } = params;
    const [from, to] = {
      [MmsDirection.Inbound]: [phoneNumber, TWILIO_NUMBER],
      [MmsDirection.Outbound]: [TWILIO_NUMBER, phoneNumber],
    }[direction];
    await query(
      `INSERT INTO "mms" ("to", "from", "body", "direction", "status", "twilioSid", "sentById")
       VALUES ($1, $2, 'hi', $3, 'received', gen_random_uuid(), $4)`,
      [to, from, direction, sentById],
    );
  };

  beforeAll(async () => {
    const before = dataSourceFor({
      migrations: migrationFiles((t) => t < THREAD_ROWS_TIMESTAMP),
      dropSchema: true,
    });
    await before.initialize();
    await before.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await before.runMigrations({ transaction: "all" });
    await before.destroy();

    migration = dataSourceFor({
      migrations: migrationFiles((t) => t === THREAD_ROWS_TIMESTAMP),
      dropSchema: false,
    });
    await migration.initialize();
  }, 300000);

  afterAll(async () => {
    await migration.destroy();
  });

  it("adds a row for each number with an inbound or staff text, keeping existing rows", async () => {
    const [admin] = await query<{ id: number }>(
      `INSERT INTO "user" ("name", "email", "referralCode")
       VALUES ('Sam Example', 'admin@example.com', 'ref-admin') RETURNING "id"`,
    );
    await query(
      `INSERT INTO "mms_thread" ("phoneNumber", "optedOut") VALUES ('+14155550101', true)`,
    );
    await text({
      phoneNumber: "+14155550101",
      direction: MmsDirection.Inbound,
      sentById: null,
    });
    await text({
      phoneNumber: "+14155550102",
      direction: MmsDirection.Inbound,
      sentById: null,
    });
    await text({
      phoneNumber: "+14155550102",
      direction: MmsDirection.Inbound,
      sentById: null,
    });
    await text({
      phoneNumber: "+14155550103",
      direction: MmsDirection.Outbound,
      sentById: null,
    });
    await text({
      phoneNumber: "+14155550104",
      direction: MmsDirection.Outbound,
      sentById: admin!.id,
    });

    await migration.runMigrations({ transaction: "all" });

    expect(
      await query(
        `SELECT "phoneNumber", "optedOut" FROM "mms_thread" ORDER BY "phoneNumber"`,
      ),
    ).toEqual([
      { phoneNumber: "+14155550101", optedOut: true },
      { phoneNumber: "+14155550102", optedOut: null },
      { phoneNumber: "+14155550104", optedOut: null },
    ]);
  });
});

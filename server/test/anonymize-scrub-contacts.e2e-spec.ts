import { readFileSync } from "node:fs";
import path from "node:path";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import { DataSource, type QueryRunner } from "typeorm";

const SCRUB_SQL = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "anonymize",
  "scrub_contacts.sql",
);

const STAND_IN = "+15550000000";

describe("anonymize scrub_contacts (e2e)", () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  beforeAll(async () => {
    const options = testConnectionOptions();
    if (options.type !== "postgres") {
      throw new Error(`expected postgres test options, got ${options.type}`);
    }
    const { host, port, username, password, database } = options;
    dataSource = new DataSource({
      type: "postgres",
      host,
      port,
      username,
      password,
      database,
    });
    await dataSource.initialize();
    // pg_temp functions live only in the session that created them.
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(readFileSync(SCRUB_SQL, "utf8"));
  });

  afterAll(async () => {
    await runner.release();
    await dataSource.destroy();
  });

  const scrub = async (text: string): Promise<string> => {
    const [row] = await runner.query(
      "SELECT pg_temp.scrub_contacts($1) AS out",
      [text],
    );
    return row.out;
  };

  const scrubJsonb = async (params: {
    value: unknown;
    answers: boolean;
  }): Promise<unknown> => {
    const [row] = await runner.query(
      "SELECT pg_temp.scrub_contacts_jsonb($1::jsonb, $2) AS out",
      [JSON.stringify(params.value), params.answers],
    );
    return row.out;
  };

  it.each([
    ["write jane.doe@gmail.com", "write redacted@example.com"],
    ["call +14155551234 now", `call ${STAND_IN} now`],
    ["call +1 415 555 1234", `call ${STAND_IN}`],
    ["call +1 (415) 555-1234", `call ${STAND_IN}`],
    ["call (415) 555-1234.", `call ${STAND_IN}.`],
    ["415-555-1234", STAND_IN],
    ["415.555.1234", STAND_IN],
    ["1-415-555-1234", STAND_IN],
    ["+44 20 7946 0958", STAND_IN],
    ["+234 803 123 4567", STAND_IN],
  ])("scrubs %p", async (input, expected) => {
    expect(await scrub(input)).toBe(expected);
  });

  it.each([
    "staff@worldalliance.org",
    "hello@thealliance.org",
    "clerk@city.springfield.gov",
    "waitlist7@example.com",
    "+15551234567",
    "cid=4155551234",
    "id 4155551234",
    "2026-10-29T12:00:00Z",
    "01a189e9-15d8-7000-8886-9dee38808751",
    "ref 12-345-6789",
  ])("keeps %p", async (input) => {
    expect(await scrub(input)).toBe(input);
  });

  it("scrubs a look-alike of an allowed domain", async () => {
    expect(await scrub("a@worldalliance.org.evil.com")).toBe(
      "redacted@example.com",
    );
  });

  it("scrubs contacts next to a newline in a jsonb string", async () => {
    expect(
      await scrubJsonb({
        value: { note: ["Call me:\n415-555-1234", "Line\njane@gmail.com"] },
        answers: false,
      }),
    ).toEqual({
      note: [`Call me:\n${STAND_IN}`, "Line\nredacted@example.com"],
    });
  });

  it("scrubs an answer that is only a number, but not such a value elsewhere", async () => {
    const value = { "field-1": "4155551234", "field-2": " 415-5551234 " };
    expect(await scrubJsonb({ value, answers: true })).toEqual({
      "field-1": STAND_IN,
      "field-2": STAND_IN,
    });
    expect(await scrubJsonb({ value, answers: false })).toEqual(value);
  });

  const scrubJsonString = async (value: string): Promise<unknown> => {
    const [row] = await runner.query(
      "SELECT pg_temp.scrub_contacts_json_string(to_jsonb($1::text)) AS out",
      [value],
    );
    return row.out;
  };

  it("scrubs contacts after an escaped newline in a serialized JSON string", async () => {
    const out = await scrubJsonString(
      JSON.stringify({ text: "Best,\nJane\n415-555-1234\njane@gmail.com" }),
    );
    expect(typeof out === "string" && JSON.parse(out)).toEqual({
      text: `Best,\nJane\n${STAND_IN}\nredacted@example.com`,
    });
  });

  it("keeps a serialized JSON string with no contacts byte for byte", async () => {
    const value = '{"b":1,  "a":"no contacts here"}';
    expect(await scrubJsonString(value)).toBe(value);
  });

  it("keeps non-string jsonb values", async () => {
    const value = { n: 4155551234, ok: true, none: null, list: [] };
    expect(await scrubJsonb({ value, answers: true })).toEqual(value);
  });
});

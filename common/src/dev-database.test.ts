import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNotDevDatabase,
  devDatabaseOnDisk,
  envFileValue,
} from "./dev-database";

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".tmp-test",
  "dev-database",
);

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "dev-database-"));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function makeCheckout(contents: string): string {
  fs.mkdirSync(path.join(sandbox, "server"), { recursive: true });
  fs.writeFileSync(path.join(sandbox, "server", ".env"), contents);

  return sandbox;
}

describe("envFileValue", () => {
  it("reads a key", () => {
    const file = path.join(sandbox, ".env");
    fs.writeFileSync(file, "DB_NAME=alliance\nDB_HOST=localhost\n");

    expect(envFileValue(file, "DB_NAME")).toBe("alliance");
  });

  // A grep would pass the comment through to database deletion commands.
  it("stops at an inline comment", () => {
    const file = path.join(sandbox, ".env");
    fs.writeFileSync(file, "DB_NAME=alliance # main checkout\n");

    expect(envFileValue(file, "DB_NAME")).toBe("alliance");
  });

  it.each([
    ['DB_NAME="alliance"', "alliance"],
    ["DB_NAME='alliance'", "alliance"],
    ["export DB_NAME=alliance", "alliance"],
    ["DB_NAME=alliance\r\n", "alliance"],
  ])("unwraps %s", (line, expected) => {
    const file = path.join(sandbox, ".env");
    fs.writeFileSync(file, `${line}\n`);

    expect(envFileValue(file, "DB_NAME")).toBe(expected);
  });

  it("is null for a missing key", () => {
    const file = path.join(sandbox, ".env");
    fs.writeFileSync(file, "DB_HOST=localhost\n");

    expect(envFileValue(file, "DB_NAME")).toBeNull();
  });

  it("is null for a missing file, which is what CI has", () => {
    expect(
      envFileValue(path.join(sandbox, "absent.env"), "DB_NAME"),
    ).toBeNull();
  });
});

describe("devDatabaseOnDisk", () => {
  it("reads DB_NAME out of server/.env", () => {
    expect(devDatabaseOnDisk(makeCheckout("DB_NAME=alliance\n"))).toBe(
      "alliance",
    );
  });

  it("is null where there is no server/.env", () => {
    expect(devDatabaseOnDisk(sandbox)).toBeNull();
  });
});

describe("assertNotDevDatabase", () => {
  const guard = (repoRoot: string, database: string) =>
    assertNotDevDatabase({
      repoRoot,
      database,
      action: "drop",
      recovery: "Set CITESTING_DB_NAME to a throwaway database.",
    });

  it("throws when the name is this checkout's dev database", () => {
    const repoRoot = makeCheckout("DB_NAME=alliance\n");

    expect(() => guard(repoRoot, "alliance")).toThrow(
      "refusing to drop alliance, which server/.env names as this checkout's dev database. Set CITESTING_DB_NAME to a throwaway database.",
    );
  });

  it("passes a throwaway database", () => {
    const repoRoot = makeCheckout("DB_NAME=alliance\n");

    expect(() => guard(repoRoot, "citesting")).not.toThrow();
  });

  it("has nothing to check without a server/.env", () => {
    expect(() => guard(sandbox, "citesting")).not.toThrow();
  });
});

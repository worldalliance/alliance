import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeEnv } from "../common/src/node-env";
import { committedEnv, deployedStoreKeys } from "../server/src/config/env";
import {
  DB_SYNC_KEYS,
  DB_SYNC_PREFIX,
  DEV_PREFIX,
  devExpectations,
  expectations,
  findDrift,
  SHARED_PREFIX,
} from "./check-parameter-drift";
import devSecrets from "./dev-secrets.json";

const expected = [
  {
    prefix: "/alliance/dev/server/",
    required: new Set(["ONE"]),
    allowed: new Set(["ONE", "OPTIONAL"]),
    allowedBy: "the manifest",
  },
];

test("passes when the store matches", () => {
  expect(
    findDrift({
      names: ["/alliance/dev/server/ONE", "/alliance/dev/server/OPTIONAL"],
      expected,
    }),
  ).toEqual([]);
});

test("reports a required key the store lacks", () => {
  expect(findDrift({ names: [], expected })).toEqual([
    "/alliance/dev/server/ONE is missing",
  ]);
});

test("reports a key nothing allows, naming what allows keys there", () => {
  expect(
    findDrift({
      names: ["/alliance/dev/server/ONE", "/alliance/dev/server/DB_NAME"],
      expected,
    }),
  ).toEqual(["/alliance/dev/server/DB_NAME is not in the manifest"]);
});

test("reports a dev consumer nothing expects", () => {
  expect(
    findDrift({
      names: ["/alliance/dev/server/ONE", "/alliance/dev/web/KEY"],
      expected,
    }),
  ).toEqual(["/alliance/dev/web/KEY is under no known consumer"]);
});

test("reports a deployed path nothing expects", () => {
  expect(
    findDrift({
      names: [
        "/alliance/dev/server/ONE",
        "/alliance/production/server/KEY",
        "/alliance/staging/sever/KEY",
      ],
      expected,
    }),
  ).toEqual([
    "/alliance/production/server/KEY is under no known consumer",
    "/alliance/staging/sever/KEY is under no known consumer",
  ]);
});

test("ignores the CI paths", () => {
  expect(
    findDrift({
      names: [
        "/alliance/dev/server/ONE",
        "/alliance/ci/review/KEY",
        "/alliance/staging/ci/KEY",
      ],
      expected,
    }),
  ).toEqual([]);
});

test("allows the listed shared keys without requiring them", () => {
  expect(
    findDrift({
      names: ["/alliance/shared/EC2_SSH_KEY", "/alliance/shared/OTHER"],
      expected: expectations().filter(({ prefix }) => prefix === SHARED_PREFIX),
    }),
  ).toEqual([
    "/alliance/shared/OTHER is not in SHARED_KEYS in scripts/check-parameter-drift.ts",
  ]);
});

const sorted = (keys: Iterable<string>) => [...keys].sort();

test("requires exactly each dev consumer's manifest secrets", () => {
  expect(
    expectations()
      .filter(({ prefix }) => prefix.startsWith(DEV_PREFIX))
      .map(({ prefix, required }) => [prefix, sorted(required)]),
  ).toEqual(
    Object.entries(devSecrets).map(([consumer, { secrets }]) => [
      `${DEV_PREFIX}${consumer}/`,
      sorted(secrets),
    ]),
  );
});

test("allows a dev consumer's retiring keys without requiring them", () => {
  const expected = devExpectations({
    server: { envFile: "server/.env", secrets: ["ONE"], retiring: ["OLD"] },
  });
  for (const names of [["ONE", "OLD"], ["ONE"]])
    expect(
      findDrift({
        names: names.map((key) => `/alliance/dev/server/${key}`),
        expected,
      }),
    ).toEqual([]);
  expect(findDrift({ names: ["/alliance/dev/server/OLD"], expected })).toEqual([
    "/alliance/dev/server/ONE is missing",
  ]);
});

test("rejects a dev key listed as both a secret and retiring", () => {
  expect(() =>
    devExpectations({ server: { secrets: ["ONE"], retiring: ["ONE"] } }),
  ).toThrow("server lists ONE in both secrets and retiring");
});

test("deployed paths require the uncommitted keys and allow only the deployed store's", () => {
  const deployed = expectations().filter(
    ({ prefix }) =>
      !prefix.startsWith(DEV_PREFIX) && prefix.endsWith("/server/"),
  );
  expect(deployed.map(({ prefix }) => prefix)).toEqual([
    "/alliance/staging/server/",
    "/alliance/prod/server/",
  ]);
  for (const { required, allowed } of deployed) {
    expect(required.has("JWT_SECRET")).toBe(true);
    expect(required.has("MAIL_FROM")).toBe(false);
    expect(sorted(required).filter((key) => !allowed.has(key))).toEqual([]);
    expect(allowed.has("ASSETS_BUCKET")).toBe(true);
    expect(allowed.has("ADMIN_USER")).toBe(false);
  }
});

test("no key a deployed path may hold is also committed config", () => {
  for (const nodeEnv of [NodeEnv.Staging, NodeEnv.Production]) {
    const committed = new Set(
      Object.entries(committedEnv(nodeEnv)).flatMap(([key, value]) =>
        value === undefined ? [] : [key],
      ),
    );
    expect(deployedStoreKeys.filter((key) => committed.has(key))).toEqual([]);
  }
});

test("a deployed path may not hold dev keys or committed config", () => {
  const names = [
    "ADMIN_USER",
    "NODE_ENV",
    "MAIL_FROM",
    "DB_NAME",
    "USE_DEV_AI_DETECTION",
  ].map((key) => `/alliance/staging/server/${key}`);
  const problems = findDrift({
    names,
    expected: expectations().filter(
      ({ prefix }) => prefix === "/alliance/staging/server/",
    ),
  });
  for (const name of names) {
    expect(problems).toContain(
      `${name} is not in inDeployedStore in server/src/config/env.ts`,
    );
  }
});

test("--required lists each path's required keys without AWS", () => {
  const listed = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "check-parameter-drift.ts"),
      "--required",
    ],
    { env: { PATH: "" } },
  );
  expect(listed.exitCode).toBe(0);
  expect(listed.stdout.toString()).toMatch(
    /^\/alliance\/staging\/server\/: .*\bJWT_SECRET\b/m,
  );
});

test("the store requires every key sync_prod_to_staging.sh loads", () => {
  const script = readFileSync(
    join(import.meta.dir, "sync_prod_to_staging.sh"),
    "utf8",
  );
  const listed = (name: string) =>
    new RegExp(`^${name}=\\(([^)]*)\\)`, "m")
      .exec(script)?.[1]
      .split(/\s+/)
      .filter(Boolean);
  expect(script).toContain(`SECRETS_PATH=${DB_SYNC_PREFIX}\n`);
  expect(listed("SYNC_KEYS")?.sort()).toEqual([...DB_SYNC_KEYS].sort());
  const expected = (path: string) =>
    expectations().find(({ prefix }) => prefix === path);
  expect(expected(DB_SYNC_PREFIX)?.required).toEqual(new Set(DB_SYNC_KEYS));
  expect(expected(DB_SYNC_PREFIX)?.allowed).toEqual(new Set(DB_SYNC_KEYS));
  expect(script).toContain(
    `--path /alliance/staging/server/ "\${SERVER_KEYS[@]}"`,
  );
  const serverKeys = listed("SERVER_KEYS") ?? [];
  expect(serverKeys.length).toBeGreaterThan(0);
  const staging = expected("/alliance/staging/server/")?.required;
  for (const key of serverKeys) expect(staging).toContain(key);
});

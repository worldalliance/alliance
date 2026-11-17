import { z } from "zod";
import { missingSuffix } from "../common/src/env";
import { NodeEnv } from "../common/src/node-env";
import { deployedStoreKeys, validateServerEnv } from "../server/src/config/env";
import devSecrets from "./dev-secrets.json";

export type Expected = {
  prefix: string;
  required: ReadonlySet<string>;
  allowed: ReadonlySet<string>;
  allowedBy: string;
};

export const DEV_PREFIX = "/alliance/dev/";
const CI_PATH = /^\/alliance\/(staging\/)?ci\//;
export const SHARED_PREFIX = "/alliance/shared/";
const SHARED_KEYS = ["APPLE_KEY_F9J58D7K92_P8_BASE64", "EC2_SSH_KEY"];
export const DB_SYNC_PREFIX = "/alliance/staging/db-sync/";
export const DB_SYNC_KEYS = [
  "HEALTHCHECK_URL",
  "PROD_ASSETS_BUCKET",
  "PROD_DB_HOST",
  "PROD_DB_PASSWORD",
  "PROD_DB_USER",
  "SLACK_WEBHOOK_URL",
  "STAGING_PASSWORD_HASH",
];

export function findDrift(params: {
  names: readonly string[];
  expected: readonly Expected[];
}): string[] {
  const { names, expected } = params;
  const problems = expected.flatMap(
    ({ prefix, required, allowed, allowedBy }) => {
      const present = new Set(
        names
          .filter((name) => name.startsWith(prefix))
          .map((name) => name.slice(prefix.length)),
      );
      return [
        ...[...required]
          .filter((key) => !present.has(key))
          .map((key) => `${prefix}${key} is missing`),
        ...[...present]
          .filter((key) => !allowed.has(key))
          .map((key) => `${prefix}${key} is not in ${allowedBy}`),
      ];
    },
  );
  const strays = names
    .filter(
      (name) =>
        !CI_PATH.test(name) &&
        !expected.some(({ prefix }) => name.startsWith(prefix)),
    )
    .map((name) => `${name} is under no known consumer`);
  return [...problems, ...strays].sort();
}

function requiredKeys(nodeEnv: NodeEnv.Staging | NodeEnv.Production): string[] {
  const result = validateServerEnv({ NODE_ENV: nodeEnv });
  if (result.ok) return [];
  const notMissing = result.error.filter(
    (line) => !line.endsWith(missingSuffix),
  );
  if (notMissing.length > 0) {
    throw new Error(`committed config is invalid: ${notMissing.join("; ")}`);
  }
  return result.error.map((line) => line.slice(0, -missingSuffix.length));
}

const devManifest = z.record(
  z.string(),
  z.object({
    secrets: z.array(z.string()),
    retiring: z.array(z.string()).default([]),
  }),
);

export function devExpectations(manifest: unknown): Expected[] {
  return Object.entries(devManifest.parse(manifest)).map(
    ([consumer, { secrets, retiring }]) => {
      const both = retiring.filter((key) => secrets.includes(key));
      if (both.length > 0) {
        throw new Error(
          `${consumer} lists ${both.join(", ")} in both secrets and retiring`,
        );
      }
      return {
        prefix: `${DEV_PREFIX}${consumer}/`,
        required: new Set(secrets),
        allowed: new Set([...secrets, ...retiring]),
        allowedBy: "scripts/dev-secrets.json",
      };
    },
  );
}

export function expectations(): Expected[] {
  const dev = devExpectations(devSecrets);
  const deployed = [
    { store: "staging", nodeEnv: NodeEnv.Staging },
    { store: "prod", nodeEnv: NodeEnv.Production },
  ] as const;
  return [
    ...dev,
    {
      prefix: SHARED_PREFIX,
      required: new Set(),
      allowed: new Set(SHARED_KEYS),
      allowedBy: "SHARED_KEYS in scripts/check-parameter-drift.ts",
    },
    {
      prefix: DB_SYNC_PREFIX,
      required: new Set(DB_SYNC_KEYS),
      allowed: new Set(DB_SYNC_KEYS),
      allowedBy: "DB_SYNC_KEYS in scripts/check-parameter-drift.ts",
    },
    ...deployed.map(({ store, nodeEnv }) => ({
      prefix: `/alliance/${store}/server/`,
      required: new Set(requiredKeys(nodeEnv)),
      allowed: new Set(deployedStoreKeys),
      allowedBy: "inDeployedStore in server/src/config/env.ts",
    })),
  ];
}

function main(): number {
  if (process.argv.includes("--required")) {
    for (const { prefix, required } of expectations())
      console.log(`${prefix}: ${[...required].sort().join(" ")}`);
    return 0;
  }
  // The CLI's paginator follows NextToken past empty pages.
  const listed = Bun.spawnSync([
    "aws",
    "ssm",
    "describe-parameters",
    "--region",
    "us-west-2",
    "--parameter-filters",
    "Key=Path,Option=Recursive,Values=/alliance",
    "--query",
    "Parameters[].Name",
    "--output",
    "json",
  ]);
  if (listed.exitCode !== 0) {
    console.error(`could not list parameters:\n${listed.stderr.toString()}`);
    return 1;
  }
  const names = z.array(z.string()).parse(JSON.parse(listed.stdout.toString()));
  const problems = findDrift({ names, expected: expectations() });
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) return 1;
  const checked = names.filter((name) => !CI_PATH.test(name)).length;
  console.log(`${checked} parameters match the config schemas`);
  return 0;
}

if (import.meta.main) process.exit(main());

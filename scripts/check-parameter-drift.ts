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

export function expectations(): Expected[] {
  const dev = Object.entries(devSecrets).map(([consumer, { secrets }]) => ({
    prefix: `${DEV_PREFIX}${consumer}/`,
    required: new Set(secrets),
    allowed: new Set(secrets),
    allowedBy: "scripts/dev-secrets.json",
  }));
  const deployed = [
    { store: "staging", nodeEnv: NodeEnv.Staging },
    { store: "prod", nodeEnv: NodeEnv.Production },
  ] as const;
  return [
    ...dev,
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

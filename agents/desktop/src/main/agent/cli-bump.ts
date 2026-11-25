import semver from "semver";
import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import { claudePackage, codexPackage } from "./cli-versions";

export const bundledCli = z.enum([claudePackage, codexPackage]);
export type BundledCli = z.infer<typeof bundledCli>;

const registryPackage = z.object({
  "dist-tags": z.record(z.string(), z.string()),
  time: z.record(z.string(), z.string()),
  versions: z.record(
    z.string(),
    z.looseObject({ deprecated: z.string().optional() }),
  ),
});
export type RegistryPackage = z.infer<typeof registryPackage>;

const cooldownMs = 7 * 24 * 60 * 60 * 1000;

// Claude Code's stable tag runs about a week behind latest, skipping releases with major regressions. Codex has no such tag, so its newest release that is a week old and neither deprecated nor unpublished, as a broken one gets, stands in for one.
const candidate: Record<
  BundledCli,
  (registry: RegistryPackage, now: Date) => Result<string | undefined, Error>
> = {
  [claudePackage]: (registry) => {
    const stable = registry["dist-tags"].stable;
    if (!stable)
      return R.failure(new Error(`${claudePackage} has no stable tag`));
    return semver.valid(stable)
      ? R.success(stable)
      : R.failure(
          new Error(`${claudePackage}'s stable tag ${stable} is not a version`),
        );
  },
  [codexPackage]: (registry, now) =>
    R.success(
      Object.entries(registry.time)
        .filter(
          ([version, published]) =>
            /^\d+\.\d+\.\d+$/.test(version) &&
            registry.versions[version] !== undefined &&
            !registry.versions[version].deprecated &&
            now.getTime() - Date.parse(published) >= cooldownMs,
        )
        .map(([version]) => version)
        .sort(semver.rcompare)[0],
    ),
};

/** The version to bump cli to, or undefined when it follows no version newer than pinned. */
export function proposedVersion(params: {
  cli: BundledCli;
  pinned: string;
  registry: RegistryPackage;
  now: Date;
}): Result<string | undefined, Error> {
  const target = candidate[params.cli](params.registry, params.now);
  if (!target.ok) return target;
  return R.success(
    target.value && semver.gt(target.value, params.pinned)
      ? target.value
      : undefined,
  );
}

export async function fetchRegistryPackage(
  cli: BundledCli,
): Promise<Result<RegistryPackage, Error>> {
  const response = await R.fromPromise(
    fetch(`https://registry.npmjs.org/${cli}`),
  );
  if (!response.ok) return response;
  if (!response.value.ok)
    return R.failure(
      new Error(
        `the npm registry answered ${response.value.status} for ${cli}`,
      ),
    );
  const body = await R.fromPromise(response.value.json());
  if (!body.ok) return body;
  return R.fromThrowable(() => registryPackage.parse(body.value));
}

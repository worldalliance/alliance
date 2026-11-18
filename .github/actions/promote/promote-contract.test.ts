import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { REQUIRED } from "./fixtures";

test("REQUIRED is the gate on every check plus every job deploy-environment.yaml records", () => {
  const workflow = (name: string) =>
    Bun.YAML.parse(
      readFileSync(`${import.meta.dir}/../../workflows/${name}`, "utf8"),
    );
  const checks = z
    .object({
      jobs: z
        .object({ passed: z.object({ needs: z.array(z.string()) }) })
        .catchall(z.unknown()),
    })
    .parse(workflow("deploy-checks.yaml")).jobs;
  expect(checks.passed.needs.toSorted()).toEqual(
    Object.keys(checks)
      .filter((job) => job !== "passed")
      .toSorted(),
  );
  // A job's `name:` replaces its id in the name the jobs API reports.
  const names = (file: string) =>
    z
      .object({
        jobs: z.record(z.string(), z.object({ name: z.string().optional() })),
      })
      .parse(workflow(file)).jobs;
  const checkNames = names("deploy-checks.yaml");
  const deployNames = names("deploy-environment.yaml");
  const recorded = z
    .object({
      jobs: z.object({ record: z.object({ needs: z.array(z.string()) }) }),
    })
    .parse(workflow("deploy-environment.yaml")).jobs.record.needs;
  const callers = z
    .object({
      jobs: z.record(
        z.string(),
        z.object({ uses: z.string().optional(), name: z.string().optional() }),
      ),
    })
    .parse(workflow("deploy.yaml")).jobs;
  const prefixes = (file: string) =>
    Object.entries(callers)
      .filter(([, job]) => job.uses === `./.github/workflows/${file}`)
      .map(([id, job]) => job.name ?? id);
  expect(prefixes("deploy-checks.yaml")).toEqual(["checks"]);
  expect(prefixes("deploy-environment.yaml")).toEqual(["deploy"]);
  expect(REQUIRED).toEqual([
    `checks / ${checkNames.passed?.name ?? "passed"}`,
    ...recorded
      .filter((job) => job !== "guard")
      .map((job) => `deploy / ${deployNames[job]?.name ?? job}`),
  ]);
});

import { beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const monitoring = join(import.meta.dir, "../deploy/monitoring");

const rule = z
  .object({
    groups: z.array(
      z.object({
        rules: z.array(
          z.object({
            uid: z.string(),
            condition: z.string(),
            data: z.array(
              z.object({
                refId: z.string(),
                model: z.object({
                  expr: z.string().optional(),
                  expression: z.string().optional(),
                  conditions: z.array(z.unknown()).optional(),
                }),
              }),
            ),
            for: z.string(),
            noDataState: z.string(),
          }),
        ),
      }),
    ),
  })
  .parse(
    Bun.YAML.parse(
      readFileSync(
        join(monitoring, "grafana/provisioning/alerting/rules.yaml"),
        "utf8",
      ),
    ),
  )
  .groups.flatMap((group) => group.rules)
  .find((r) => r.uid === "alliance-api-db-readiness");

const query = (refId: string) => rule?.data.find((d) => d.refId === refId);

const prometheusVersion = z
  .string()
  .parse(
    /image: prom\/prometheus:v(\S+)/.exec(
      readFileSync(join(monitoring, "docker-compose.yml"), "utf8"),
    )?.[1],
  );

// Fetched rather than taken from PATH, so every machine runs the pinned
// release and a missing binary fails the test instead of skipping it.
async function promtool(): Promise<string> {
  const releaseOs: Partial<Record<string, string>> = {
    darwin: "darwin",
    linux: "linux",
  };
  const releaseArch: Partial<Record<string, string>> = {
    arm64: "arm64",
    x64: "amd64",
  };
  const os = releaseOs[process.platform];
  const arch = releaseArch[process.arch];
  if (!os || !arch)
    throw new Error(
      `no promtool build for ${process.platform}-${process.arch}`,
    );
  const name = `prometheus-${prometheusVersion}.${os}-${arch}`;
  const dir = join(import.meta.dir, "../node_modules/.cache/promtool", name);
  const bin = join(dir, name, "promtool");
  if (existsSync(bin)) return bin;

  const release = `https://github.com/prometheus/prometheus/releases/download/v${prometheusVersion}`;
  const fetchOk = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res;
  };
  const sums = await (await fetchOk(`${release}/sha256sums.txt`)).text();
  const expected = new RegExp(`^([0-9a-f]{64})  ${name}\\.tar\\.gz$`, "m").exec(
    sums,
  )?.[1];
  if (!expected) throw new Error(`${name}.tar.gz missing from sha256sums.txt`);
  const tarball = new Uint8Array(
    await (await fetchOk(`${release}/${name}.tar.gz`)).arrayBuffer(),
  );
  const actual = new Bun.CryptoHasher("sha256").update(tarball).digest("hex");
  if (actual !== expected)
    throw new Error(`${name}.tar.gz sha256 ${actual}, expected ${expected}`);

  const staging = `${dir}.partial`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const tar = Bun.spawnSync(["tar", "-xzf", "-", `${name}/promtool`], {
    cwd: staging,
    stdin: tarball,
    stderr: "pipe",
  });
  if (tar.exitCode !== 0) throw new Error(`tar: ${tar.stderr}`);
  rmSync(dir, { recursive: true, force: true });
  renameSync(staging, dir);
  return bin;
}

type Case = {
  name: string;
  probes: string;
  apiUp: string;
  firing: number[];
  quiet: number[];
};

// A trailing `_` with evaluations past its slot is a probe still running,
// whose sample hasn't landed.
const cases: Case[] = [
  {
    name: "healthy",
    probes: "1 1 1 1 1 1 1 1",
    apiUp: "1 1 1 1 1 1 1 1",
    firing: [],
    quiet: [30, 60, 105],
  },
  {
    name: "sustained failure with the API up",
    probes: "1 1 1 0 0 0 0 0",
    apiUp: "1 1 1 1 1 1 1 1",
    firing: [70, 80, 90, 100, 105],
    quiet: [50, 60],
  },
  {
    name: "sustained failure, the newest probe still running",
    probes: "1 1 1 0 0 0 0 _",
    apiUp: "1 1 1 1 1 1 1 1",
    firing: [107, 109, 111],
    quiet: [],
  },
  {
    name: "a single failure",
    probes: "1 1 1 0 1 1 1 1",
    apiUp: "1 1 1 1 1 1 1 1",
    firing: [],
    quiet: [50, 55, 60, 65, 70, 80, 90],
  },
  {
    name: "a single failure, the probe after it still running",
    probes: "1 1 1 0 _",
    apiUp: "1 1 1 1 1",
    firing: [],
    quiet: [50, 55, 60, 62, 64, 70],
  },
  {
    name: "an API restart gap",
    probes: "1 1 0 0 0 0 1 1 1",
    apiUp: "1 1 0 0 0 0 1 1 1",
    firing: [],
    quiet: [40, 50, 60, 70, 80, 90, 100, 110],
  },
  {
    name: "a probe gap after a monitoring restart",
    probes: "1 1 _ _ _ 0 0 0 0",
    apiUp: "1 1 _ _ _ 1 1 1 1",
    firing: [115],
    quiet: [50, 60, 70, 80, 90],
  },
  {
    name: "no probe data",
    probes: "_ _ _ _ _ _",
    apiUp: "1 1 1 1 1 1",
    firing: [],
    quiet: [40, 60, 75],
  },
  {
    name: "recovery",
    probes: "1 0 0 0 0 1 1 1 1",
    apiUp: "1 1 1 1 1 1 1 1",
    firing: [50, 75],
    quiet: [90, 100, 115],
  },
];

describe("the readiness alert", () => {
  test("is Grafana's threshold below 1 on its query, firing at once and quiet on no data", () => {
    expect(rule?.condition).toBe("B");
    expect(query("B")?.model).toMatchObject({
      expression: "A",
      conditions: [{ evaluator: { type: "lt", params: [1] } }],
    });
    expect(rule?.for).toBe("0s");
    expect(rule?.noDataState).toBe("OK");
  });

  describe("under promtool", () => {
    let bin: string;
    beforeAll(async () => {
      bin = await promtool();
    }, 120_000);

    for (const c of cases) {
      test(c.name, () => {
        const dir = mkdtempSync(join(tmpdir(), "readiness-rule-"));
        writeFileSync(
          join(dir, "rules.yml"),
          JSON.stringify({
            groups: [
              {
                name: "readiness",
                rules: [
                  {
                    alert: "Readiness",
                    expr: `(${z.string().parse(query("A")?.model.expr)}) < 1`,
                  },
                ],
              },
            ],
          }),
        );
        const evals = (times: number[], firing: boolean) =>
          times.map((t) => ({
            eval_time: `${t}s`,
            alertname: "Readiness",
            exp_alerts: firing ? [{ exp_labels: {} }] : [],
          }));
        writeFileSync(
          join(dir, "test.yml"),
          JSON.stringify({
            rule_files: ["rules.yml"],
            evaluation_interval: "1s",
            tests: [
              {
                interval: "15s",
                input_series: [
                  {
                    series: 'probe_success{job="api_db_readiness"}',
                    values: c.probes,
                  },
                  { series: 'up{job="app_server_api"}', values: c.apiUp },
                ],
                alert_rule_test: [
                  ...evals(c.firing, true),
                  ...evals(c.quiet, false),
                ],
              },
            ],
          }),
        );
        const run = Bun.spawnSync([bin, "test", "rules", "test.yml"], {
          cwd: dir,
          stderr: "pipe",
        });
        rmSync(dir, { recursive: true, force: true });
        expect(`${run.stdout}${run.stderr}`).not.toContain("FAILED");
        expect(run.exitCode).toBe(0);
      });
    }
  });
});

import { afterEach, beforeEach } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const COMMIT = "c".repeat(40);
export const REQUIRED = [
  ...readFileSync(`${import.meta.dir}/promote.sh`, "utf8")
    .match(/^REQUIRED=\(\n([^)]*)\n\)/m)![1]
    .matchAll(/"([^"]+)"/g),
].map((match) => match[1]);

// Each route answers calls whose arguments contain `match`, the first
// matching route winning; `{ fail }` makes the call fail with that message.
// A route whose response sets `times` answers only that many matching calls.
export type Route = { match: string; response: unknown };

const FAKE_GH = `#!/usr/bin/env bun
import { appendFileSync, readFileSync } from "node:fs";
const dir = process.env.FAKE_DIR;
const args = process.argv.slice(2);
const line = args.join(" ");
appendFileSync(dir + "/calls", line + "\\n");
const routes = JSON.parse(readFileSync(dir + "/routes.json", "utf8"));
const calls = readFileSync(dir + "/calls", "utf8").split("\\n");
const route = routes.find((r) => line.includes(r.match) && !(calls.filter((c) => c.includes(r.match)).length > r.response?.times));
if (!route) { console.error("no route for: " + line); process.exit(1); }
const { response } = route;
if (response && response.fail) { console.error(response.fail); process.exit(1); }
const jq = args.indexOf("--jq");
const result = Bun.spawnSync(["jq", "-r", jq < 0 ? "." : args[jq + 1]], { stdin: Buffer.from(JSON.stringify(response)) });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.exitCode);
`;

export function makeFakeGhDir() {
  const dir = mkdtempSync(join(tmpdir(), "promote-"));
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  writeFileSync(join(dir, "sleep"), "#!/bin/sh\n");
  chmodSync(join(dir, "sleep"), 0o755);
  writeFileSync(join(dir, "calls"), "");
  return dir;
}

export function useFakeGh() {
  let dir = "";
  beforeEach(() => {
    dir = makeFakeGhDir();
  });
  afterEach(() => rmSync(dir, { recursive: true }));
  return (params: { routes: Route[]; env?: Record<string, string> }) =>
    promote({ dir, ...params });
}

export const run = (id: number) => ({
  id,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

export const jobs = (overrides: Record<string, string | null> = {}) => ({
  jobs: [
    ...REQUIRED.map((name) => ({
      name,
      status: overrides[name] === null ? "in_progress" : "completed",
      conclusion: name in overrides ? overrides[name] : "success",
    })),
    {
      name: "deploy / publish-mobile-ota / publish-mobile-ota",
      status: "completed",
      conclusion: "failure",
    },
  ],
});

export const ARTIFACT_NAMES = [
  "react-build",
  "react-assets",
  "admin-build",
  "deployed-config",
];
export const artifacts = (expired: string[] = [], names = ARTIFACT_NAMES) => ({
  artifacts: names.map((name, i) => ({
    name,
    id: 100 + i,
    expired: expired.includes(name),
  })),
});
export function promote(params: {
  dir: string;
  routes: Route[];
  env?: Record<string, string>;
}) {
  const { dir } = params;
  writeFileSync(join(dir, "routes.json"), JSON.stringify(params.routes));
  const output = join(dir, "output");
  const summary = join(dir, "summary");
  writeFileSync(output, "");
  writeFileSync(summary, "");
  const result = Bun.spawnSync(["bash", `${import.meta.dir}/promote.sh`], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_DIR: dir,
      GITHUB_REPOSITORY: "o/r",
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      COMMIT,
      ...params.env,
    },
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    output: readFileSync(output, "utf8"),
    summary: readFileSync(summary, "utf8"),
    calls: readFileSync(join(dir, "calls"), "utf8"),
  };
}

import { afterEach, beforeEach } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each route answers calls whose arguments contain `match`, the first
// matching route winning; `{ fail }` makes the call fail with that message.
// A route whose response sets `times` answers only that many matching calls.
export type Route = { match: string; response: unknown };

export const fail = (match: string): Route => ({
  match,
  response: { fail: "HTTP 502" },
});

const FAKE_GH = `#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const dir = process.env.FAKE_DIR;
const args = process.argv.slice(2);
const line = args.join(" ");
appendFileSync(dir + "/calls", line + "\\n");
if (line.includes("--input -")) writeFileSync(dir + "/input", readFileSync(0));
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

function makeFakeGhDir() {
  const dir = mkdtempSync(join(tmpdir(), "fake-gh-"));
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  // A no-op sleep, so retry delays cost nothing.
  writeFileSync(join(dir, "sleep"), "#!/bin/sh\n");
  chmodSync(join(dir, "sleep"), 0o755);
  writeFileSync(join(dir, "calls"), "");
  return dir;
}

function runScript(params: {
  dir: string;
  command: string[];
  routes: Route[];
  env?: Record<string, string>;
}) {
  const { dir } = params;
  writeFileSync(join(dir, "routes.json"), JSON.stringify(params.routes));
  const output = join(dir, "output");
  const summary = join(dir, "summary");
  const input = join(dir, "input");
  writeFileSync(output, "");
  writeFileSync(summary, "");
  rmSync(input, { force: true });
  const result = Bun.spawnSync(["bash", ...params.command], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_DIR: dir,
      GITHUB_REPOSITORY: "o/r",
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
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
    input: existsSync(input) ? readFileSync(input, "utf8") : null,
  };
}

export function useFakeGh() {
  let dir = "";
  beforeEach(() => {
    dir = makeFakeGhDir();
  });
  afterEach(() => rmSync(dir, { recursive: true }));
  return (params: {
    command: string[];
    routes: Route[];
    env?: Record<string, string>;
  }) => runScript({ dir, ...params });
}

import { describe, expect, test } from "bun:test";
import { type Route, fail } from "../fake-gh";
import { COMMIT, artifacts, jobs, run, usePromote } from "./fixtures";

const promote = usePromote();

const staging = (...runs: ReturnType<typeof run>[]): Route => ({
  match: `deploy.yaml/runs?branch=main&event=push&head_sha=${COMMIT}`,
  response: { workflow_runs: runs },
});

describe("promote.sh with a fully green staging run", () => {
  test("outputs the run and its artifacts, ignoring jobs off the required list", () => {
    const result = promote({
      routes: [
        staging(run(7)),
        { match: "runs/7/jobs", response: jobs() },
        { match: "runs/7/artifacts", response: artifacts() },
      ],
    });
    expect(result.code).toBe(0);
    const ids = '{"admin-build":102,"react-assets":101,"react-build":100}';
    expect(result.output).toBe(
      `run_id=7\nartifact_ids=${ids}\ndetails={"staging_run":"https://github.com/o/r/actions/runs/7","artifacts":${ids}}\n`,
    );
    expect(result.summary).toContain("Promoting `" + COMMIT + "`");
    expect(result.calls).toContain("runs/7/jobs?filter=latest");
  });

  test("promotes without source maps", () => {
    const result = promote({
      routes: [
        staging(run(7)),
        { match: "runs/7/jobs", response: jobs() },
        {
          match: "runs/7/artifacts",
          response: artifacts([], ["admin-build", "react-build"]),
        },
      ],
    });
    expect(result.code).toBe(0);
    expect(result.output).toContain(
      'artifact_ids={"admin-build":100,"react-build":101}\n',
    );
  });
});

describe("promote.sh leaves the production run to build", () => {
  test.each([
    ["without a staging run", [staging()], "it has no staging Deploy run."],
    [
      "while its staging run is in progress",
      [
        staging(run(7)),
        {
          match: "runs/7/jobs",
          response: jobs({ "deploy / verify-api": null }),
        },
      ],
      "isn't fully green: deploy / verify-api (in_progress).",
    ],
    [
      "when its staging run failed",
      [
        staging(run(7)),
        {
          match: "runs/7/jobs",
          response: jobs({
            "checks / passed": "skipped",
            "deploy / verify-https": "failure",
          }),
        },
      ],
      "isn't fully green: checks / passed (skipped), deploy / verify-https (failure).",
    ],
    [
      "when its staging run lacks a required job",
      [staging(run(7)), { match: "runs/7/jobs", response: { jobs: [] } }],
      "checks / passed (missing)",
    ],
    [
      "when a required artifact expired",
      [
        staging(run(7)),
        { match: "runs/7/jobs", response: jobs() },
        { match: "runs/7/artifacts", response: artifacts(["admin-build"]) },
      ],
      "lacks unexpired artifacts: admin-build.",
    ],
    [
      "when its staging run lists an artifact twice",
      [
        staging(run(7)),
        { match: "runs/7/jobs", response: jobs() },
        {
          match: "runs/7/artifacts",
          response: artifacts(
            [],
            ["admin-build", "react-build", "react-build"],
          ),
        },
      ],
      "lists artifacts more than once: react-build.",
    ],
  ])("%s", (_, routes, why) => {
    const result = promote({ routes });
    expect(result.code).toBe(0);
    expect(result.output).toBe("");
    expect(result.summary).toContain(`Building \`${COMMIT}\` in this run: `);
    expect(result.summary).toContain(why);
  });
});

test.each([
  ["runs", [fail(`head_sha=${COMMIT}`)]],
  ["jobs", [staging(run(7)), fail("runs/7/jobs")]],
  [
    "artifacts",
    [
      staging(run(7)),
      { match: "runs/7/jobs", response: jobs() },
      fail("runs/7/artifacts"),
    ],
  ],
])(
  "promote.sh fails, rather than building, when reading the %s fails",
  (_, routes) => {
    const result = promote({ routes });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("HTTP 502");
    const calls = result.calls.trim().split("\n");
    expect(calls.length - new Set(calls).size).toBe(2);
    expect(result.output).toBe("");
    expect(result.summary).not.toContain("Building");
  },
);

test("promote.sh retries a failed read", () => {
  const result = promote({
    routes: [
      staging(run(7)),
      { match: "runs/7/jobs", response: { fail: "HTTP 502", times: 2 } },
      { match: "runs/7/jobs", response: jobs() },
      { match: "runs/7/artifacts", response: artifacts() },
    ],
  });
  expect(result.code).toBe(0);
  expect(result.output).toContain("run_id=7\n");
  expect(result.calls.match(/runs\/7\/jobs/g)).toHaveLength(3);
});

test("promote.sh fails on a commit that isn't a full SHA", () => {
  const result = promote({ env: { COMMIT: "cccc" }, routes: [] });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("commit must be a full SHA");
  expect(result.calls).toBe("");
});

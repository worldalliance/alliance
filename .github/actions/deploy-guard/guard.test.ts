import { describe, expect, test } from "bun:test";
import { type Route, fail, useFakeGh } from "../fake-gh";
import { COMMIT, NEWER, deployments } from "./fixtures";

const fakeGh = useFakeGh();

const compare = (status: string): Route => ({
  match: `/compare/${COMMIT}...`,
  response: { status },
});
const tip = (sha: string): Route => ({
  match: "/git/ref/heads/production",
  response: { object: { sha } },
});

function guard(params: { routes?: Route[]; env?: Record<string, string> }) {
  const result = fakeGh({
    command: [`${import.meta.dir}/guard.sh`],
    routes: [
      ...(params.routes ?? []),
      deployments("staging-live"),
      { match: "POST repos/o/r/deployments --input", response: { id: 42 } },
      { match: "POST repos/o/r/deployments/42/statuses", response: {} },
    ],
    env: {
      ENVIRONMENT: "staging",
      DETAILS: "{}",
      COMMIT,
      RUN_URL: "https://github.com/o/r/actions/runs/7/attempts/1",
      ...params.env,
    },
  });
  return { ...result, body: result.input && JSON.parse(result.input) };
}

function expectDeploys(result: ReturnType<typeof guard>) {
  expect(result.code).toBe(0);
  expect(result.output).toBe("deployment_id=42\n");
  expect(result.calls).toContain(
    "api -X POST repos/o/r/deployments/42/statuses -f state=in_progress -f log_url=https://github.com/o/r/actions/runs/7/attempts/1 -F auto_inactive=false --silent",
  );
}

function expectSkips(result: ReturnType<typeof guard>, reason: string) {
  expect(result.code).toBe(0);
  expect(result.output).toBe("deployment_id=\n");
  expect(result.stdout).toContain(reason);
  expect(result.summary).toContain(reason);
  expect(result.calls).not.toContain("POST");
}

describe("guard.sh on staging", () => {
  test("deploys when nothing is recorded, opening a staging-live deployment", () => {
    const result = guard({});
    expectDeploys(result);
    expect(result.calls).toContain(
      "repos/o/r/deployments?environment=staging-live&per_page=1",
    );
    expect(result.calls).not.toContain("compare");
    expect(result.body).toEqual({
      ref: COMMIT,
      environment: "staging-live",
      auto_merge: false,
      required_contexts: [],
      production_environment: false,
      payload: {},
    });
  });

  test("skips when a strictly newer commit's deploy started, even if it failed", () => {
    const result = guard({
      routes: [
        deployments("staging-live", [9, NEWER], [8, COMMIT]),
        compare("ahead"),
      ],
    });
    expectSkips(
      result,
      `a deploy of ${NEWER}, a newer commit, already started on staging.`,
    );
    expect(result.calls).toContain(`repos/o/r/compare/${COMMIT}...${NEWER}`);
    expect(result.calls).not.toContain("statuses");
  });

  test("redeploys the newest recorded commit on a re-run", () => {
    const result = guard({
      routes: [deployments("staging-live", [9, COMMIT])],
    });
    expectDeploys(result);
    expect(result.calls).not.toContain("compare");
  });

  test.each(["behind", "diverged"])(
    "deploys when the newest recorded commit is %s",
    (status) => {
      expectDeploys(
        guard({
          routes: [deployments("staging-live", [9, NEWER]), compare(status)],
        }),
      );
    },
  );

  test.each(["", "identical"])(
    "fails on compare status '%s', neither ahead, behind nor diverged",
    (status) => {
      const result = guard({
        routes: [deployments("staging-live", [9, NEWER]), compare(status)],
      });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("unexpected compare status");
      expect(result.calls).not.toContain("POST");
    },
  );

  test("fails when the deployments lookup fails", () => {
    const result = guard({ routes: [fail("/deployments?")] });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });

  test("fails when the compare lookup fails", () => {
    const result = guard({
      routes: [deployments("staging-live", [9, NEWER]), fail("/compare/")],
    });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });

  test.each(["POST repos/o/r/deployments --input", "/statuses"])(
    "fails without a deployment_id when '%s' fails",
    (match) => {
      const result = guard({ routes: [fail(match)] });
      expect(result.code).not.toBe(0);
      expect(result.output).not.toContain("deployment_id=");
    },
  );
});

describe("guard.sh on production", () => {
  test("deploys the production branch's tip, recording the details", () => {
    const result = guard({
      routes: [tip(COMMIT)],
      env: { ENVIRONMENT: "production", DETAILS: '{"staging_run":"run"}' },
    });
    expectDeploys(result);
    expect(result.body).toMatchObject({
      environment: "production-live",
      production_environment: true,
      payload: { staging_run: "run" },
    });
  });

  test("skips a commit the branch has moved past", () => {
    expectSkips(
      guard({ routes: [tip(NEWER)], env: { ENVIRONMENT: "production" } }),
      `the production branch now points at ${NEWER}.`,
    );
  });

  test("fails when the branch lookup fails", () => {
    const result = guard({
      routes: [fail("git/ref/heads/production")],
      env: { ENVIRONMENT: "production" },
    });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });
});

test("guard.sh fails on an unknown environment", () => {
  const result = guard({ env: { ENVIRONMENT: "prod" } });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("unknown environment: prod");
});

test.each(["", "cccccccc"])(
  "guard.sh fails on commit '%s', not a full SHA",
  (commit) => {
    const result = guard({
      routes: [tip(COMMIT)],
      env: { ENVIRONMENT: "production", COMMIT: commit },
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("commit must be a full SHA");
    expect(result.calls).toBe("");
  },
);

test.each(['"x"', "[]", "null", "not json", "{} {}"])(
  "guard.sh fails on details %s, not a JSON object",
  (details) => {
    const result = guard({ env: { DETAILS: details } });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("details must be a JSON object");
    expect(result.calls).toBe("");
  },
);

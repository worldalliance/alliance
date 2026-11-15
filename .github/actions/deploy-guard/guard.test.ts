import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMIT, NEWER, makeFakeGhDir, runScript } from "./fake-gh";

let dir: string;

beforeEach(() => {
  dir = makeFakeGhDir();
});

afterEach(() => rmSync(dir, { recursive: true }));

function guard(env: Record<string, string>) {
  const output = join(dir, "output");
  writeFileSync(output, "");
  const result = runScript({
    dir,
    command: ["guard.sh"],
    env: {
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
      ENVIRONMENT: "staging",
      COMMIT,
      RUN_URL: "https://github.com/o/r/actions/runs/7/attempts/1",
      ...env,
    },
  });
  const body = join(dir, "body");
  return {
    ...result,
    output: readFileSync(output, "utf8"),
    body: existsSync(body) ? JSON.parse(readFileSync(body, "utf8")) : null,
  };
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
  expect(readFileSync(join(dir, "summary"), "utf8")).toContain(reason);
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
    });
  });

  test("skips when a strictly newer commit's deploy started, even if it failed", () => {
    const result = guard({
      FAKE_DEPLOYMENTS: `9 ${NEWER}\n8 ${COMMIT}\n`,
      FAKE_COMPARE: "ahead",
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
      FAKE_DEPLOYMENTS: `9 ${COMMIT}\n`,
    });
    expectDeploys(result);
    expect(result.calls).not.toContain("compare");
  });

  test.each(["behind", "diverged"])(
    "deploys when the newest recorded commit is %s",
    (status) => {
      expectDeploys(
        guard({
          FAKE_DEPLOYMENTS: `9 ${NEWER}\n`,
          FAKE_COMPARE: status,
        }),
      );
    },
  );

  test.each(["", "identical"])(
    "fails on compare status '%s', neither ahead, behind nor diverged",
    (status) => {
      const result = guard({
        FAKE_DEPLOYMENTS: `9 ${NEWER}\n`,
        FAKE_COMPARE: status,
      });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("unexpected compare status");
      expect(result.calls).not.toContain("POST");
    },
  );

  test("fails when the deployments lookup fails", () => {
    const result = guard({
      FAKE_DEPLOYMENTS: `9 ${NEWER}\n`,
      FAKE_FAIL: "/deployments?",
    });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });

  test("fails when the compare lookup fails", () => {
    const result = guard({
      FAKE_DEPLOYMENTS: `9 ${NEWER}\n`,
      FAKE_FAIL: "/compare/",
    });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });

  test.each(["POST repos/o/r/deployments --input", "/statuses"])(
    "fails without a deployment_id when '%s' fails",
    (fail) => {
      const result = guard({ FAKE_FAIL: fail });
      expect(result.code).not.toBe(0);
      expect(result.output).not.toContain("deployment_id=");
    },
  );
});

describe("guard.sh on production", () => {
  test("deploys the production branch's tip", () => {
    const result = guard({ ENVIRONMENT: "production", FAKE_TIP: COMMIT });
    expectDeploys(result);
    expect(result.body).toMatchObject({
      environment: "production-live",
      production_environment: true,
    });
  });

  test("skips a commit the branch has moved past", () => {
    expectSkips(
      guard({ ENVIRONMENT: "production", FAKE_TIP: NEWER }),
      `the production branch now points at ${NEWER}.`,
    );
  });

  test("fails when the branch lookup fails", () => {
    const result = guard({
      ENVIRONMENT: "production",
      FAKE_FAIL: "git/ref/heads/production",
    });
    expect(result.code).not.toBe(0);
    expect(result.calls).not.toContain("POST");
  });
});

test("guard.sh fails on an unknown environment", () => {
  const result = guard({ ENVIRONMENT: "prod" });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("unknown environment: prod");
});

test.each(["", "cccccccc"])(
  "guard.sh fails on commit '%s', not a full SHA",
  (commit) => {
    const result = guard({
      ENVIRONMENT: "production",
      FAKE_TIP: COMMIT,
      COMMIT: commit,
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("commit must be a full SHA");
    expect(result.calls).toBe("");
  },
);

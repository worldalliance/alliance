import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  markdownText,
  resolveRequest,
  validateEvidence,
  validateRequest,
} from "./pr-screenshots.cjs";

const sha = "a".repeat(40);
const pr = {
  number: 42,
  state: "open",
  base: { sha: "b".repeat(40), repo: { full_name: "example/app" } },
  head: { sha, repo: { full_name: "contributor/app" } },
};

describe("remote screenshot request", () => {
  test("pins an open fork PR to the explicitly requested head", () => {
    expect(
      validateRequest({
        pr,
        number: "42",
        expectedHead: sha,
        repo: "example/app",
      }),
    ).toEqual({
      pr: "42",
      base: "b".repeat(40),
      head: sha,
      head_repo: "contributor/app",
    });
  });

  test("rejects stale heads, closed PRs, wrong repositories, and malformed input", () => {
    const input = { pr, number: "42", expectedHead: sha, repo: "example/app" };
    for (const change of [
      { expectedHead: "c".repeat(40) },
      { expectedHead: "main" },
      { number: "42; echo injected" },
      { repo: "other/app" },
      { pr: { ...pr, state: "closed" } },
      { pr: { ...pr, head: { ...pr.head, repo: null } } },
    ]) {
      expect(() => validateRequest({ ...input, ...change })).toThrow();
    }
  });

  test("a rerun by a reader cannot reuse a writer's authorization", async () => {
    const previous = process.env.RERUN_ACTOR;
    process.env.RERUN_ACTOR = "reader";
    let fetchedPr = false;
    try {
      await expect(
        resolveRequest({
          context: { actor: "writer", repo: { owner: "example", repo: "app" } },
          core: {
            setOutput: () => {
              throw new Error("Unexpected output");
            },
          },
          github: {
            rest: {
              repos: {
                getCollaboratorPermissionLevel: async ({
                  username,
                }: {
                  username: string;
                }) => ({
                  data: {
                    permission: username === "writer" ? "write" : "read",
                  },
                }),
              },
              pulls: {
                get: async () => {
                  fetchedPr = true;
                  return { data: pr };
                },
              },
            },
          },
        }),
      ).rejects.toThrow("Only repository writers");
      expect(fetchedPr).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.RERUN_ACTOR;
      else process.env.RERUN_ACTOR = previous;
    }
  });
});

describe("untrusted screenshot artifacts", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  );
  const report = {
    summary: "Synthetic picker",
    limitations: "Fixture only",
    pairs: [
      {
        title: "Open",
        before: "before.png",
        after: "after.png",
        description: "Tapped picker",
      },
    ],
  };

  function withEvidence(run: (directory: string) => void) {
    const directory = mkdtempSync(resolve("../.scratch/pr-screenshots-test-"));
    try {
      writeFileSync(resolve(directory, "before.png"), png);
      writeFileSync(resolve(directory, "after.png"), png);
      writeFileSync(resolve(directory, "report.json"), JSON.stringify(report));
      run(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  test("accepts regular PNG pairs", () => {
    withEvidence((directory) => {
      expect(validateEvidence(directory)).toEqual(report);
    });
  });

  test("publishes an artifact link with the built-in token and rejects a moved PR head", () => {
    withEvidence((directory) => {
      const evidence = resolve(directory, ".scratch/pr-screenshots/evidence");
      mkdirSync(evidence, { recursive: true });
      for (const name of ["before.png", "after.png", "report.json"])
        copyFileSync(resolve(directory, name), resolve(evidence, name));
      for (const expectedHead of [sha, "c".repeat(40)]) {
        const result = Bun.spawnSync(
          [
            "node",
            "-e",
            `const { publishEvidence } = require(process.argv[1]);
          publishEvidence({
            context: { repo: { owner: 'example', repo: 'app' }, serverUrl: 'https://github.com', runId: 123 },
            github: { rest: {
              pulls: { get: async () => ({ data: JSON.parse(process.argv[2]) }) },
              issues: { createComment: async (comment) => console.log(JSON.stringify(comment)) }
            } }
          }).catch(() => { process.exitCode = 1; });`,
            resolve(import.meta.dir, "pr-screenshots.cjs"),
            JSON.stringify(pr),
          ],
          {
            cwd: directory,
            env: {
              ...process.env,
              PR_NUMBER: "42",
              HEAD_SHA: expectedHead,
              BASE_SHA: "b".repeat(40),
              NATIVE_PLATFORM: "ios",
              ARTIFACT_URL:
                "https://github.com/example/app/actions/runs/123/artifacts/456",
            },
          },
        );
        if (expectedHead !== sha) {
          expect(result.exitCode).toBe(1);
          expect(result.stdout.toString()).toBe("");
          continue;
        }
        expect(result.exitCode).toBe(0);
        const comment = JSON.parse(result.stdout.toString());
        expect(comment.issue_number).toBe(42);
        expect(comment.body).toContain(
          "[Download before/after screenshots](https://github.com/example/app/actions/runs/123/artifacts/456)",
        );
        expect(comment.body).toContain("| `before.png` | `after.png` |");
      }
    });
  });

  test("rejects traversal, flags, missing images, duplicated sides, and empty evidence", () => {
    withEvidence((directory) => {
      for (const before of [
        "../before.png",
        "--before.png",
        "missing.png",
        "after.png",
      ]) {
        writeFileSync(
          resolve(directory, "report.json"),
          JSON.stringify({
            ...report,
            pairs: [{ ...report.pairs[0], before }],
          }),
        );
        expect(() => validateEvidence(directory)).toThrow();
      }
      writeFileSync(
        resolve(directory, "report.json"),
        JSON.stringify({ ...report, pairs: [] }),
      );
      expect(() => validateEvidence(directory)).toThrow();
    });
  });

  test("rejects symlinks, non-PNG data, and oversized reports", () => {
    withEvidence((directory) => {
      rmSync(resolve(directory, "before.png"));
      symlinkSync(
        resolve(directory, "after.png"),
        resolve(directory, "before.png"),
      );
      expect(() => validateEvidence(directory)).toThrow();
      rmSync(resolve(directory, "before.png"));
      writeFileSync(resolve(directory, "before.png"), "#!/bin/sh\necho attack");
      expect(() => validateEvidence(directory)).toThrow();
      writeFileSync(resolve(directory, "report.json"), " ".repeat(65537));
      expect(() => validateEvidence(directory)).toThrow();
    });
  });

  test("rejects malformed reports, oversized text, and too many pairs", () => {
    withEvidence((directory) => {
      for (const invalid of [
        null,
        [],
        {},
        { ...report, summary: 42 },
        { ...report, limitations: "x".repeat(4001) },
        { ...report, pairs: Array(9).fill(report.pairs[0]) },
        { ...report, pairs: [null] },
      ]) {
        writeFileSync(
          resolve(directory, "report.json"),
          JSON.stringify(invalid),
        );
        expect(() => validateEvidence(directory)).toThrow();
      }
    });
  });

  test("renders agent text without HTML, mentions, or Markdown links", () => {
    expect(
      markdownText("@all <img> [click](https://example.com) | row\nnext"),
    ).toBe(
      "&#64;all &lt;img&gt; \\[click\\]\\(https://example.com\\) \\| row next",
    );
  });
});

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  markdownText,
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

  test("renders agent text without HTML, mentions, or Markdown links", () => {
    expect(
      markdownText("@all <img> [click](https://example.com) | row\nnext"),
    ).toBe(
      "&#64;all &lt;img&gt; \\[click\\]\\(https://example.com\\) \\| row next",
    );
  });
});

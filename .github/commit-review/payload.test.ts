import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const workflow = Bun.YAML.parse(
  await Bun.file(`${import.meta.dir}/../workflows/code-review.yaml`).text(),
);
const script = workflow.jobs.review.steps.find(
  (step: { id?: string }) => step.id === "slack_body_review",
)?.run;
if (typeof script !== "string") throw new Error("Missing Slack payload step");

const scratch = join(import.meta.dir, "../../.scratch");
mkdirSync(scratch, { recursive: true });
const runUrl = "https://github.com/example/project/actions/runs/1234";

function payload(input: { summary: string; mention?: string }) {
  const dir = mkdtempSync(join(scratch, "review-payload-"));
  try {
    const result = Bun.spawnSync(["bash", "-c", script], {
      cwd: dir,
      env: {
        ...process.env,
        SUMMARY: input.summary,
        SLACK_MENTION: input.mention ?? "",
        RUN_URL: runUrl,
        GITHUB_OUTPUT: join(dir, "output"),
      },
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return JSON.parse(readFileSync(join(dir, "slack.json"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("keeps short findings, the author mention, and the full-review link", () => {
  const result = payload({
    summary: "- A reachable failure.\n[NEEDS_ATTENTION]",
    mention: "<@UREVIEWER>",
  });
  expect(result.blocks[0].text.text).toBe(
    "<@UREVIEWER> - A reachable failure.",
  );
  expect(result.blocks[1].elements[0].url).toBe(runUrl);
});

test("counts the mention when enforcing the 3000-character section limit", () => {
  const mention = "<@UREVIEWER>";
  const summary = "x".repeat(3000 - mention.length - 1);
  expect(payload({ summary, mention }).blocks[0].text.text).toBe(
    `${mention} ${summary}`,
  );
  const oversized = payload({ summary: `${summary}x`, mention });
  expect(oversized.blocks[0].text.text.length).toBeLessThanOrEqual(3000);
  expect(oversized.blocks[0].text.text).toContain(mention);
  expect(oversized.blocks[0].text.text).toContain("full reports");
  expect(oversized.blocks[1].elements[0].url).toBe(runUrl);
});

test("replaces an oversized single-review report with the full-report link", () => {
  const result = payload({
    summary: `## Must-fix\n${"Evidence and fix. ".repeat(600)}<cursor://file/example.ts:1|example.ts>\n[NEEDS_ATTENTION]`,
  });
  expect(result.blocks[0].text.text.length).toBeLessThanOrEqual(3000);
  expect(result.blocks[0].text.text).toContain("full reports");
  expect(result.blocks[0].text.text).not.toContain("<cursor:");
  expect(result.blocks[1].elements[0].url).toBe(runUrl);
});

test("measures Unicode characters rather than bytes", () => {
  const summary = "😀".repeat(3000);
  expect(payload({ summary }).blocks[0].text.text).toBe(summary);
  const text = payload({ summary: `${summary}😀` }).blocks[0].text.text;
  expect(Array.from(text).length).toBeLessThanOrEqual(3000);
});

test("uses the full-report link when the summarizer produces no findings text", () => {
  for (const summary of ["", " \n\t[NEEDS_ATTENTION]\n"]) {
    for (const mention of ["", "<@UREVIEWER>"]) {
      const result = payload({ summary, mention });
      expect(result.blocks[0].text.text).toContain("Review needs attention.");
      expect(result.blocks[0].text.text).toContain("full reports");
      expect(result.blocks[0].text.text).toContain(mention);
      expect(result.blocks[1].elements[0].url).toBe(runUrl);
    }
  }
});

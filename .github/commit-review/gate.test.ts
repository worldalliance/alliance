import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const workflow = Bun.YAML.parse(
  await Bun.file(`${import.meta.dir}/../workflows/code-review.yaml`).text(),
);
const script = workflow.jobs.review.steps.find(
  (step: { id?: string }) => step.id === "combine_reviews",
)?.run;
if (typeof script !== "string")
  throw new Error("Missing review combination step");

test("the reviewers' final markers control notification independently of the combiner", () => {
  const scratch = join(import.meta.dir, "../../.scratch");
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, "review-gate-"));
  writeFileSync(
    join(dir, "curl"),
    '#!/bin/sh\nprintf "%s\\n" "$COMBINER_RESPONSE"\n',
    {
      mode: 0o700,
    },
  );
  const cases = [
    {
      claude: "Nits only.",
      codex: "No issues.",
      combined: "A nit. [NEEDS_ATTENTION]",
      expected: false,
    },
    {
      claude: "A real defect.\n[NEEDS_ATTENTION]",
      codex: "No issues.",
      combined: "A summary without a marker.",
      expected: true,
    },
    {
      claude: "No issues.",
      codex: "A real defect.\n[NEEDS_ATTENTION]\n  ",
      combined: "A summary.",
      expected: true,
    },
    {
      claude: "The workflow uses [NEEDS_ATTENTION] as a marker. No issues.",
      codex: "",
      combined: "",
      expected: false,
    },
    ...[
      "`[NEEDS_ATTENTION]`",
      "**[NEEDS_ATTENTION]**",
      "[NEEDS_ATTENTION].",
    ].map((marker) => ({
      claude: `A real defect.\n${marker}`,
      codex: "No issues.",
      combined: "A summary.",
      expected: true,
    })),
    { claude: "", codex: "", combined: "", expected: false },
  ];
  try {
    for (const [index, input] of cases.entries()) {
      const output = join(dir, `output-${index}`);
      const result = Bun.spawnSync(["bash", "-c", script], {
        cwd: dir,
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          CLAUDE_FINAL_MESSAGE: input.claude,
          CODEX_FINAL_MESSAGE: input.codex,
          OPENAI_API_KEY: "test-placeholder",
          COMBINER_RESPONSE: JSON.stringify({
            choices: [{ message: { content: input.combined } }],
          }),
          GITHUB_OUTPUT: output,
        },
      });
      if (result.exitCode !== 0)
        throw new Error(`case ${index + 1}: ${result.stderr.toString()}`);
      const stepOutput = readFileSync(output, "utf8");
      expect(stepOutput.split("\n"), `case ${index + 1}`).toContain(
        `needs_review=${input.expected}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

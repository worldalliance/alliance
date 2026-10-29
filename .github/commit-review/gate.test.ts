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

test("reviewer markers control notification and every available review is summarized", () => {
  const scratch = join(import.meta.dir, "../../.scratch");
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, "review-gate-"));
  writeFileSync(
    join(dir, "curl"),
    '#!/bin/sh\nprintf "%s\\n" "$COMBINER_RESPONSE"\nexit "${CURL_EXIT:-0}"\n',
    {
      mode: 0o700,
    },
  );
  const cases: {
    claude: string;
    codex: string;
    combined: string;
    expected: boolean;
    curlExit?: number;
    rawResponse?: string;
  }[] = [
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
    {
      claude:
        "Summary and checks.\nMust-fix: a real defect.\nNits: a name.\n[NEEDS_ATTENTION]",
      codex: "",
      combined: "- A real defect.",
      expected: true,
    },
    {
      claude: "A real defect.\n[NEEDS_ATTENTION]",
      codex: "",
      combined: "",
      expected: true,
      curlExit: 6,
    },
    {
      claude: "A real defect.\n[NEEDS_ATTENTION]",
      codex: "No issues.",
      combined: "",
      expected: true,
      rawResponse: "not-json",
    },
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
          CURL_EXIT: String(input.curlExit ?? 0),
          COMBINER_RESPONSE:
            input.rawResponse ??
            JSON.stringify({
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
      if (input.claude || input.codex) {
        expect(stepOutput, `case ${index + 1}`).toContain(
          `\n${input.combined}\n`,
        );
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

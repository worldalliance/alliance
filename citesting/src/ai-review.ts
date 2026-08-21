import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const logPrefix = "[citesting:ai-review]";

// Pages with less than this % of pixels changed are auto-passed
const TRIVIAL_DIFF_THRESHOLD = 0.05;

// Max concurrent API calls
const CONCURRENCY = 5;

type ReviewResult = {
  page: string;
  status: "pass" | "fail";
  reason: string;
  aiReviewed: boolean;
};

type DiffStats = Record<
  string,
  { diffPixels: number; totalPixels: number; pct: number }
>;

const toBase64 = async (filePath: string): Promise<string> => {
  const buf = await fs.readFile(filePath);
  return buf.toString("base64");
};

const fileExists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const reviewPage = async (
  client: Anthropic,
  pageName: string,
  baselinePath: string,
  currentPath: string,
): Promise<ReviewResult> => {
  const [baselineB64, currentB64] = await Promise.all([
    toBase64(baselinePath),
    toBase64(currentPath),
  ]);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    tools: [
      {
        name: "report_review",
        description: "Report the visual regression review result for a page.",
        input_schema: {
          type: "object" as const,
          properties: {
            page: {
              type: "string",
              description: "The page name being reviewed",
            },
            status: {
              type: "string",
              enum: ["pass", "fail"],
              description:
                "pass if the changes are acceptable (minor/expected), fail if there is a visual regression",
            },
            reason: {
              type: "string",
              description:
                "Brief explanation of what changed and why it passes or fails",
            },
          },
          required: ["page", "status", "reason"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_review" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a visual regression tester. Compare these screenshots of the "${pageName}" page.

The first image is the BASELINE.
The second image is the CURRENT build.

Decide whether the visual changes represent a regression (broken layout, missing elements, overlapping text, broken styling) or are acceptable (minor rendering differences, anti-aliasing, expected content changes).
If the first image (baseline) is broken and the current build is improved, report "pass". report "fail" if both are broken.

Report "pass" for acceptable changes and "fail" for regressions.`,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: baselineB64,
            },
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: currentB64,
            },
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as {
      page?: string;
      status: "pass" | "fail";
      reason: string;
    };
    return {
      page: input.page || pageName,
      status: input.status,
      reason: input.reason,
      aiReviewed: true,
    };
  }

  return {
    page: pageName,
    status: "fail",
    reason: "Unexpected API response format",
    aiReviewed: true,
  };
};

const runWithConcurrency = async <T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> => {
  const results: T[] = [];
  let i = 0;

  const run = async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => run()),
  );
  return results;
};

const main = async () => {
  const [baselineDir, currentDir, diffDir] = process.argv.slice(2);

  if (!baselineDir || !currentDir || !diffDir) {
    console.error(
      `Usage: ts-node ai-review.ts <baselineDir> <currentDir> <diffDir>`,
    );
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(`${logPrefix} ANTHROPIC_API_KEY is not set`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const currentFiles = (await fs.readdir(currentDir)).filter((f) =>
    f.endsWith(".png"),
  );

  if (currentFiles.length === 0) {
    console.log(`${logPrefix} No screenshots to review.`);
    process.exit(0);
  }

  // Load diff stats if available (written by compare-screenshots)
  let diffStats: DiffStats = {};
  const statsPath = path.join(diffDir, "stats.json");
  if (await fileExists(statsPath)) {
    diffStats = JSON.parse(await fs.readFile(statsPath, "utf8"));
  }

  const results: ReviewResult[] = [];
  const apiTasks: { file: string; task: () => Promise<ReviewResult> }[] = [];

  for (const file of currentFiles) {
    const pageName = file.replace(/\.png$/, "");
    const baselinePath = path.join(baselineDir, file);
    const diffPath = path.join(diffDir, file);

    const hasBaseline = await fileExists(baselinePath);
    const hasDiff = await fileExists(diffPath);

    if (!hasBaseline) {
      console.log(`${logPrefix} [PASS] ${pageName} — new page, no baseline`);
      results.push({
        page: pageName,
        status: "pass",
        reason: "New page, no baseline to compare",
        aiReviewed: false,
      });
      continue;
    }

    if (!hasDiff) {
      console.log(`${logPrefix} [PASS] ${pageName} — unchanged`);
      results.push({
        page: pageName,
        status: "pass",
        reason: "No visual changes detected",
        aiReviewed: false,
      });
      continue;
    }

    // Auto-pass trivial diffs (anti-aliasing, sub-pixel rendering)
    const stat = diffStats[file];
    if (stat && stat.pct < TRIVIAL_DIFF_THRESHOLD) {
      console.log(
        `${logPrefix} [PASS] ${pageName} — trivial diff (${stat.pct}%), skipping AI`,
      );
      results.push({
        page: pageName,
        status: "pass",
        reason: `Trivial diff (${stat.pct}% pixels changed)`,
        aiReviewed: false,
      });
      continue;
    }

    // Queue for parallel AI review
    console.log(
      `${logPrefix} Queuing ${pageName} for AI review (${
        stat ? stat.pct + "%" : "unknown"
      } diff)...`,
    );
    apiTasks.push({
      file,
      task: () =>
        reviewPage(client, pageName, baselinePath, path.join(currentDir, file)),
    });
  }

  // Run AI reviews in parallel
  if (apiTasks.length > 0) {
    console.log(
      `${logPrefix} Sending ${apiTasks.length} pages for AI review (concurrency: ${CONCURRENCY})...`,
    );
    const apiResults = await runWithConcurrency(
      apiTasks.map((t) => t.task),
      CONCURRENCY,
    );

    for (const result of apiResults) {
      results.push(result);
      const icon = result.status === "pass" ? "PASS" : "FAIL";
      console.log(`${logPrefix} [${icon}] ${result.page} — ${result.reason}`);
    }
  }

  // Write structured results to JSON file if AI_REVIEW_OUTPUT is set
  const outputPath = process.env.AI_REVIEW_OUTPUT;
  if (outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`${logPrefix} Results written to ${outputPath}`);
  }

  // Summary
  const failures = results.filter((r) => r.status === "fail");
  console.log(
    `\n${logPrefix} === Summary: ${results.length - failures.length} passed, ${
      failures.length
    } failed ===`,
  );

  if (failures.length > 0) {
    console.log(`${logPrefix} Failed pages:`);
    for (const f of failures) {
      console.log(`${logPrefix}   - ${f.page}: ${f.reason}`);
    }
    process.exit(1);
  }

  process.exit(0);
};

void main();

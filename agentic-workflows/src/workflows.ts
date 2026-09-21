import { R, type Result } from "@alliance/common/result";
import { existsSync } from "node:fs";
import { z } from "zod";
import {
  appendLog,
  appendMessage,
  spawnLogged,
  startJob,
  type StepDefinition,
} from "./jobs";
import { JobKind, RunMode, StepOutputFormat, type Job } from "./types";
import { mainRoot, panelRoot } from "./worktrees";

function scriptStep(params: {
  id: string;
  title: string;
  command: string[];
  cwd: string;
}): StepDefinition {
  return {
    id: params.id,
    title: params.title,
    command: params.command.join(" "),
    outputFormat: StepOutputFormat.Text,
    run: async (context) =>
      R.map(
        await spawnLogged({
          context,
          command: params.command,
          cwd: params.cwd,
          onStdout: (line) => appendLog(context.step, line),
        }),
        () => null,
      ),
  };
}

export function startNewWorktree(params: {
  name: string;
  from: string | null;
}): Result<Job, string> {
  return startJob({
    kind: JobKind.NewWorktree,
    label: `create worktree ${params.name}`,
    worktree: null,
    mode: RunMode.All,
    steps: [
      scriptStep({
        id: "create",
        title: "new-worktree.sh",
        command: [
          `${mainRoot}/scripts/new-worktree.sh`,
          params.name,
          ...(params.from ? ["--from", params.from] : []),
        ],
        cwd: mainRoot,
      }),
    ],
  });
}

export function startRemoveWorktree(params: {
  name: string;
}): Result<Job, string> {
  return startJob({
    kind: JobKind.RemoveWorktree,
    label: `remove worktree ${params.name}`,
    worktree: null,
    mode: RunMode.All,
    steps: [
      scriptStep({
        id: "remove",
        title: "rm-worktree.sh",
        command: [`${mainRoot}/scripts/rm-worktree.sh`, params.name],
        cwd: mainRoot,
      }),
    ],
  });
}

const resultMessageSchema = z.object({
  type: z.literal("result"),
  is_error: z.boolean(),
  result: z.string(),
});

const BASE_STEP = "base";

/**
 * The review skill writes its findings under .scratch, and a stale file from an
 * earlier run would be read as this run's.
 */
function clearScratchStep(worktree: string): StepDefinition {
  const scratch = `${worktree}/.scratch`;

  return {
    id: "scratch",
    title: "clear .scratch",
    command: `rm -rf ${scratch}`,
    outputFormat: StepOutputFormat.Text,
    run: async (context) => {
      const existed = existsSync(scratch);
      const removed = await spawnLogged({
        context,
        command: ["rm", "-rf", scratch],
        cwd: worktree,
      });

      return R.map(removed, () =>
        existed ? `removed ${scratch}` : `no ${scratch} to remove`,
      );
    },
  };
}

function reviewBasePrompt(sha: string): string {
  return `/review-base base is \`git show --stat ${sha}\``;
}

function claudeCommand(sha: string): string[] {
  return [
    "claude",
    "-p",
    "--dangerously-skip-permissions",
    "--output-format",
    "stream-json",
    reviewBasePrompt(sha),
  ];
}

export function reviewBaseSteps(params: {
  path: string;
  remote: string;
}): StepDefinition[] {
  // The panel's own checkout, not the main one: the script only needs the
  // worktree as its working directory, and main may not carry it yet.
  const commitAfter = [`${panelRoot}/scripts/commit-after.sh`, params.remote];

  return [
    {
      id: BASE_STEP,
      title: "resolve the base commit",
      command: commitAfter.join(" "),
      outputFormat: StepOutputFormat.Text,
      run: async (context) => {
        const resolved = await spawnLogged({
          context,
          command: commitAfter,
          cwd: params.path,
        });
        if (!resolved.ok) return resolved;

        const sha = resolved.value.trim();
        context.job.baseSha = sha;
        return R.success(sha);
      },
    },
    clearScratchStep(params.path),
    {
      id: "review",
      title: "review the base commit",
      command: claudeCommand("<base commit>").join(" "),
      outputFormat: StepOutputFormat.Markdown,
      run: async (context) => {
        const sha = context.outputs.get(BASE_STEP) ?? "";
        const messages: unknown[] = [];

        const output = await spawnLogged({
          context,
          command: claudeCommand(sha),
          cwd: params.path,
          onStdout: (line) => {
            const parsed = R.fromThrowable(() => JSON.parse(line));
            if (!parsed.ok) return;

            messages.push(parsed.value);
            appendMessage({ context, message: parsed.value });
          },
        });
        if (!output.ok) return output;

        for (const message of messages) {
          const parsed = resultMessageSchema.safeParse(message);
          if (!parsed.success) continue;
          if (parsed.data.is_error) return R.failure(parsed.data.result);

          return R.success(parsed.data.result);
        }

        return R.failure(
          `claude printed no result message: ${output.value.slice(-2000)}`,
        );
      },
    },
  ];
}

export function startReviewBase(params: {
  path: string;
  name: string;
  remote: string;
  mode: RunMode;
}): Result<Job, string> {
  return startJob({
    kind: JobKind.ReviewBase,
    label: `review base of ${params.name} after ${params.remote}`,
    worktree: params.path,
    steps: reviewBaseSteps(params),
    mode: params.mode,
  });
}

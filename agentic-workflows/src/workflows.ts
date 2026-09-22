import { R, type Result } from "@alliance/common/result";
import { z } from "zod";
import { codexCommand, runCodex } from "./codex";
import {
  appendLog,
  appendMessage,
  spawnLogged,
  startJob,
  type StepDefinition,
} from "./jobs";
import { archiveAgentStep, archiveReviewFiles } from "./review-archive";
import {
  pushDraftBranch,
  pushReviewedCommit,
  resolveReviewPush,
  type ReviewPushTarget,
} from "./review-push";
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

function clearScratchStep(worktree: string): StepDefinition {
  const scratch = `${worktree}/.scratch`;
  return {
    id: "scratch",
    title: "archive previous review and clear .scratch",
    command: `rm -rf ${scratch}`,
    outputFormat: StepOutputFormat.Text,
    run: async (context) => {
      const archived = await archiveReviewFiles({ context, previous: true });
      if (!archived.ok) return archived;
      return R.map(
        await spawnLogged({
          context,
          command: ["rm", "-rf", scratch],
          cwd: worktree,
        }),
        () =>
          `Archived previous review to ${archived.value}; cleared ${scratch}`,
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
    "--verbose",
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
  let codexThreadId: string | undefined;
  let pushTarget: ReviewPushTarget | undefined;
  let cleanRound = false;
  let needsAttention = false;
  const followupPrompt = (sha: string) =>
    `$review-followup assess .scratch/review/${sha}.json`;
  const applyPrompt = "$review-followup apply";
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
        const target = await resolveReviewPush({
          path: params.path,
          selectedRemote: params.remote,
          reviewedSha: sha,
        });
        if (!target.ok) return target;
        pushTarget = target.value;
        context.job.baseSha = sha;
        return R.success(sha);
      },
    },
    clearScratchStep(params.path),
    archiveAgentStep({
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

          const review = await R.fromPromiseFn(() =>
            Bun.file(`${params.path}/.scratch/review/${sha}.json`).json(),
          );
          if (!review.ok)
            return R.failure(
              `cannot read review for ${sha}: ${review.error.message}`,
            );
          const validated = z
            .object({
              base: z.literal(sha),
              summary: z.string(),
              findings: z.array(z.unknown()),
            })
            .safeParse(review.value);
          if (!validated.success)
            return R.failure(
              `invalid review for ${sha}: ${validated.error.message}`,
            );

          return R.success(parsed.data.result);
        }

        return R.failure(
          `claude printed no result message: ${output.value.slice(-2000)}`,
        );
      },
    }),
    archiveAgentStep({
      id: "assess",
      title: "assess findings with Astra",
      command: codexCommand({ prompt: followupPrompt("<base commit>") }).join(
        " ",
      ),
      outputFormat: StepOutputFormat.Markdown,
      run: async (context) => {
        const result = await runCodex({
          context,
          cwd: params.path,
          prompt: followupPrompt(context.outputs.get(BASE_STEP) ?? ""),
        });
        if (!result.ok) return result;
        codexThreadId = result.value.threadId;
        cleanRound =
          result.value.acceptedFindings === 0 && !result.value.needsAttention;
        return R.success(result.value.output);
      },
    }),
    archiveAgentStep({
      id: "apply",
      title: "apply accepted findings",
      command: codexCommand({
        prompt: applyPrompt,
        threadId: "<assessment session>",
      }).join(" "),
      outputFormat: StepOutputFormat.Markdown,
      run: async (context) => {
        if (!codexThreadId)
          return R.failure("no Codex assessment session to resume");
        return R.map(
          await runCodex({
            context,
            cwd: params.path,
            prompt: applyPrompt,
            threadId: codexThreadId,
          }),
          (result) => {
            cleanRound &&=
              result.acceptedFindings === 0 && !result.needsAttention;
            needsAttention = result.needsAttention;
            return result.output;
          },
        );
      },
    }),
    archiveAgentStep({
      id: "draft",
      title: "back up pending commits to the draft branch",
      command: "git push origin <branch tip>:refs/heads/draft/<local-branch>",
      outputFormat: StepOutputFormat.Text,
      run: async (context) => {
        if (!pushTarget) return R.failure("No remote target was captured.");
        return pushDraftBranch({
          context,
          path: params.path,
          target: pushTarget,
        });
      },
    }),
    archiveAgentStep({
      id: "push",
      title: "push the clean reviewed commit",
      command: `git push <reviewed commit>:${params.remote}`,
      outputFormat: StepOutputFormat.Markdown,
      run: async (context) => {
        if (needsAttention)
          return R.success({
            needsAttention:
              context.outputs.get("apply") ??
              "Resolve the required human actions before publishing.",
          });
        if (!cleanRound)
          return R.success(
            "Not pushed: this round needs a fresh review with no accepted findings.",
          );
        if (!pushTarget)
          return R.failure("No reviewed commit or remote target was captured.");
        return pushReviewedCommit({
          context,
          path: params.path,
          target: pushTarget,
        });
      },
    }),
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

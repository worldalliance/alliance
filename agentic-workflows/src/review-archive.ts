import { R, type Result } from "@alliance/common/result";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  appendLog,
  stepMessages,
  type StepContext,
  type StepDefinition,
} from "./jobs";

function archiveDirectory(context: StepContext): string {
  return join(
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"),
    "alliance/agentic-review",
    context.job.id,
  );
}

export async function archiveReviewFiles(params: {
  context: StepContext;
  previous?: boolean;
}): Promise<Result<string, string>> {
  const directory = join(
    archiveDirectory(params.context),
    params.previous ? "previous" : "review",
  );
  const source = join(params.context.job.worktree ?? "", ".scratch/review");
  const result = await R.fromPromiseFn(async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const files = await readdir(source, { withFileTypes: true }).catch(
      (error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return [];
        throw error;
      },
    );
    for (const file of files) {
      if (
        file.isFile() &&
        (file.name.endsWith(".json") || file.name.endsWith(".decisions.md"))
      ) {
        await copyFile(join(source, file.name), join(directory, file.name));
      }
    }
    return directory;
  });
  return R.mapError(
    result,
    (error) => `could not archive review files: ${error.message}`,
  );
}

export function archiveAgentStep(step: StepDefinition): StepDefinition {
  return {
    ...step,
    run: async (context) => {
      const directory = archiveDirectory(context);
      const prepared = await R.fromPromiseFn(() =>
        mkdir(directory, { recursive: true, mode: 0o700 }),
      );
      if (!prepared.ok)
        return R.failure(
          `could not create review archive: ${prepared.error.message}`,
        );
      const executed = await R.fromPromiseFn(() =>
        step.run({ ...context, logDirectory: directory }),
      );
      const outcome = executed.ok
        ? executed.value
        : R.failure(executed.error.message);
      const files = await archiveReviewFiles({ context });
      if (!files.ok)
        return R.failure(
          `${outcome.ok ? "" : `${outcome.error}; `}${files.error}`,
        );

      const saved = await R.fromPromiseFn(() =>
        Bun.write(
          join(directory, `${step.id}.json`),
          JSON.stringify(
            {
              jobId: context.job.id,
              worktree: context.job.worktree,
              baseSha: context.job.baseSha,
              startedAt: context.step.startedAt,
              endedAt: Date.now(),
              command: context.step.command,
              outcome,
              log: context.step.log,
              messages:
                stepMessages({ jobId: context.job.id, stepId: step.id }) ?? [],
            },
            null,
            2,
          ),
        ),
      );
      if (!saved.ok)
        return R.failure(
          `could not archive ${step.id}: ${saved.error.message}`,
        );
      appendLog(context.step, `Archived to ${directory}`);
      return outcome;
    },
  };
}

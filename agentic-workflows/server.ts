import { R, type Result } from "@alliance/common/result";
import { z } from "zod";
import index from "./index.html";
import { commitDiff } from "./src/diff";
import {
  cancelJob,
  hasActiveJob,
  snapshot,
  stepJob,
  stepMessages,
  toSteps,
} from "./src/jobs";
import { RunMode, type Job, type WorktreeSummary } from "./src/types";
import {
  reviewBaseSteps,
  startNewWorktree,
  startRemoveWorktree,
  startReviewBase,
} from "./src/workflows";
import { listWorktrees, mainRoot, worktreeDetail } from "./src/worktrees";

const PORT = Number(process.env.AGENTIC_WORKFLOWS_PORT ?? 6900);

function fail(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<Result<T, string>> {
  const json = await R.fromPromiseFn(() => request.json());
  if (!json.ok) return R.failure("body is not json");

  const parsed = schema.safeParse(json.value);
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(z.prettifyError(parsed.error));
}

async function requireWorktree(
  path: string,
): Promise<Result<WorktreeSummary, string>> {
  const worktrees = await listWorktrees();
  if (!worktrees.ok) return worktrees;

  const found = worktrees.value.find((worktree) => worktree.path === path);
  return found ? R.success(found) : R.failure(`unknown worktree ${path}`);
}

function jobResponse(started: Result<Job, string>): Response {
  return started.ok ? Response.json(started.value) : fail(started.error, 409);
}

const nameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes only");

const createSchema = z.object({
  name: nameSchema,
  from: z.string().trim().min(1).nullable(),
});

const pathSchema = z.object({ path: z.string().min(1) });

const reviewSchema = z.object({
  path: z.string().min(1),
  remote: z.string().trim().min(1),
});

const runSchema = reviewSchema.extend({
  mode: z.enum(RunMode).default(RunMode.All),
});

const cancelSchema = z.object({ id: z.string().min(1) });

const messagesSchema = z.object({
  job: z.string().min(1),
  step: z.string().min(1),
});

const diffSchema = z.object({
  path: z.string().min(1),
  oldest: z.string().min(1),
  newest: z.string().min(1),
});

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: {
    "/": index,

    "/api/state": {
      GET: async () => {
        const worktrees = await listWorktrees();
        return worktrees.ok
          ? Response.json({ worktrees: worktrees.value, jobs: snapshot() })
          : fail(worktrees.error, 500);
      },
    },

    "/api/worktree": {
      GET: async (request) => {
        const path = new URL(request.url).searchParams.get("path");
        if (!path) return fail("path is required", 400);

        const worktree = await requireWorktree(path);
        if (!worktree.ok) return fail(worktree.error, 404);

        const detail = await worktreeDetail({
          path: worktree.value.path,
          branch: worktree.value.branch,
          base: new URL(request.url).searchParams.get("base"),
        });
        return detail.ok
          ? Response.json(detail.value)
          : fail(detail.error, 500);
      },
    },

    "/api/workflow": {
      GET: async (request) => {
        const query = new URL(request.url).searchParams;
        const input = reviewSchema.safeParse({
          path: query.get("path"),
          remote: query.get("remote"),
        });
        if (!input.success) return fail(z.prettifyError(input.error), 400);

        return Response.json(toSteps(reviewBaseSteps(input.data)));
      },
    },

    "/api/messages": {
      GET: (request) => {
        const query = new URL(request.url).searchParams;
        const input = messagesSchema.safeParse({
          job: query.get("job"),
          step: query.get("step"),
        });
        if (!input.success) return fail(z.prettifyError(input.error), 400);

        const messages = stepMessages({
          jobId: input.data.job,
          stepId: input.data.step,
        });
        return messages
          ? Response.json(messages)
          : fail("that step recorded no messages", 404);
      },
    },

    "/api/diff": {
      GET: async (request) => {
        const query = new URL(request.url).searchParams;
        const input = diffSchema.safeParse({
          path: query.get("path"),
          oldest: query.get("oldest"),
          newest: query.get("newest"),
        });
        if (!input.success) return fail(z.prettifyError(input.error), 400);

        const worktree = await requireWorktree(input.data.path);
        if (!worktree.ok) return fail(worktree.error, 404);

        const diff = await commitDiff({
          cwd: worktree.value.path,
          oldest: input.data.oldest,
          newest: input.data.newest,
        });
        return diff.ok ? Response.json(diff.value) : fail(diff.error, 500);
      },
    },

    "/api/worktrees": {
      POST: async (request) => {
        const input = await body(request, createSchema);
        return input.ok
          ? jobResponse(startNewWorktree(input.value))
          : fail(input.error, 400);
      },
    },

    "/api/worktrees/remove": {
      POST: async (request) => {
        const input = await body(request, pathSchema);
        if (!input.ok) return fail(input.error, 400);

        const worktree = await requireWorktree(input.value.path);
        if (!worktree.ok) return fail(worktree.error, 404);
        if (worktree.value.isMain) {
          return fail("the main checkout cannot be removed", 400);
        }
        if (worktree.value.isPanel) {
          return fail("this panel is running from that worktree", 400);
        }
        if (hasActiveJob(worktree.value.path)) {
          return fail("a workflow is still running in that worktree", 409);
        }

        return jobResponse(startRemoveWorktree({ name: worktree.value.name }));
      },
    },

    "/api/review-base": {
      POST: async (request) => {
        const input = await body(request, runSchema);
        if (!input.ok) return fail(input.error, 400);

        const worktree = await requireWorktree(input.value.path);
        if (!worktree.ok) return fail(worktree.error, 404);

        return jobResponse(
          startReviewBase({
            path: worktree.value.path,
            name: worktree.value.name,
            remote: input.value.remote,
            mode: input.value.mode,
          }),
        );
      },
    },

    "/api/jobs/step": {
      POST: async (request) => {
        const input = await body(request, cancelSchema);
        return input.ok
          ? jobResponse(stepJob(input.value.id))
          : fail(input.error, 400);
      },
    },

    "/api/jobs/cancel": {
      POST: async (request) => {
        const input = await body(request, cancelSchema);
        if (!input.ok) return fail(input.error, 400);

        const canceled = cancelJob(input.value.id);
        return canceled.ok
          ? Response.json({ ok: true })
          : fail(canceled.error, 409);
      },
    },
  },
  fetch: () => new Response("not found", { status: 404 }),
});

console.log(`agentic workflows  http://localhost:${server.port}`);
console.log(`main checkout      ${mainRoot}`);

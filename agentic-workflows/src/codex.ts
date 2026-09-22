import { R, type Result } from "@alliance/common/result";
import { resolve } from "node:path";
import { z } from "zod";
import {
  appendLog,
  appendMessage,
  spawnLogged,
  type StepContext,
} from "./jobs";

const threadSchema = z.object({
  type: z.literal("thread.started"),
  thread_id: z.string().min(1),
});

const messageSchema = z.object({
  type: z.literal("item.completed"),
  item: z.object({ type: z.literal("agent_message"), text: z.string() }),
});

const completedSchema = z.object({ type: z.literal("turn.completed") });
const reportSchema = z.object({
  report: z.string().min(1),
  needs_attention: z.boolean(),
  accepted_findings: z.number().int().nonnegative(),
});
const failureSchema = z.union([
  z.object({
    type: z.literal("turn.failed"),
    error: z.object({ message: z.string() }),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export function codexCommand(params: {
  prompt: string;
  threadId?: string;
}): string[] {
  return [
    "codex",
    "--sandbox",
    "danger-full-access",
    "--ask-for-approval",
    "never",
    "exec",
    ...(params.threadId ? ["resume", params.threadId] : []),
    "--model",
    "gpt-6-astra",
    "--json",
    "--output-schema",
    resolve(import.meta.dir, "../codex-output.schema.json"),
    params.prompt,
  ];
}

export async function runCodex(params: {
  context: StepContext;
  cwd: string;
  prompt: string;
  threadId?: string;
}): Promise<
  Result<
    {
      threadId: string;
      output: string;
      needsAttention: boolean;
      acceptedFindings: number;
    },
    string
  >
> {
  let threadId = params.threadId;
  let output = "";
  let completed = false;
  let error: string | null = null;

  const result = await spawnLogged({
    context: params.context,
    command: codexCommand(params),
    cwd: params.cwd,
    onStdout: (line) => {
      const parsed = R.fromThrowable(() => JSON.parse(line));
      if (!parsed.ok) {
        if (line.trim()) appendLog(params.context.step, line);
        return;
      }
      appendMessage({ context: params.context, message: parsed.value });

      const thread = threadSchema.safeParse(parsed.value);
      if (thread.success) threadId = thread.data.thread_id;
      const message = messageSchema.safeParse(parsed.value);
      if (message.success) output = message.data.item.text;
      if (completedSchema.safeParse(parsed.value).success) completed = true;
      const failure = failureSchema.safeParse(parsed.value);
      if (failure.success) {
        error =
          "error" in failure.data
            ? failure.data.error.message
            : failure.data.message;
      }
    },
  });

  if (error) return R.failure(error);
  if (!result.ok) return result;
  if (!completed || !threadId || !output.trim()) {
    return R.failure(
      "codex ended without a completed turn, session ID, or final message",
    );
  }
  const json = R.fromThrowable(() => JSON.parse(output));
  if (!json.ok)
    return R.failure("codex final message is not a structured review report");
  const report = reportSchema.safeParse(json.value);
  if (!report.success)
    return R.failure(`invalid Codex review report: ${report.error.message}`);
  return R.success({
    threadId,
    output: report.data.report,
    needsAttention: report.data.needs_attention,
    acceptedFindings: report.data.accepted_findings,
  });
}

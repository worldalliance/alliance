import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { AgentEventKind, type TurnEvent } from "../../../shared/agent-event";
import { describeError } from "../../describe-error";
import type { AgentMessage } from "../session";
import type { Fits } from "./fits";
import type { InitializeParams } from "./protocol/InitializeParams.gen";
import type { AgentMessageDeltaNotification } from "./protocol/v2/AgentMessageDeltaNotification.gen";
import type { ItemCompletedNotification } from "./protocol/v2/ItemCompletedNotification.gen";
import type { ItemStartedNotification } from "./protocol/v2/ItemStartedNotification.gen";
import type { ThreadItem } from "./protocol/v2/ThreadItem.gen";
import type { ThreadResumeParams } from "./protocol/v2/ThreadResumeParams.gen";
import type { ThreadStartParams } from "./protocol/v2/ThreadStartParams.gen";
import type { ThreadStartResponse } from "./protocol/v2/ThreadStartResponse.gen";
import type { TurnCompletedNotification } from "./protocol/v2/TurnCompletedNotification.gen";
import type { TurnStartedNotification } from "./protocol/v2/TurnStartedNotification.gen";
import type { TurnStartParams } from "./protocol/v2/TurnStartParams.gen";
import type { TurnStartResponse } from "./protocol/v2/TurnStartResponse.gen";

export const initializeParams = {
  clientInfo: { name: "alliance_agent", title: "Alliance agent", version: "0" },
  capabilities: null,
} satisfies InitializeParams;

/** Approvals and sandbox off, as the desktop-app task requires of every agent. */
const permissionsOff = {
  approvalPolicy: "never",
  sandbox: "danger-full-access",
} as const satisfies Pick<ThreadStartParams, "approvalPolicy" | "sandbox">;

export const threadStartParams = (cwd: string): ThreadStartParams => ({
  cwd,
  ...permissionsOff,
});

export const threadResumeParams = (params: {
  cwd: string;
  threadId: string;
}): ThreadResumeParams => ({
  ...params,
  ...permissionsOff,
  excludeTurns: true,
});

const threadResult = z.object({ thread: z.object({ id: z.string() }) });
true satisfies Fits<typeof threadResult, ThreadStartResponse>;

export const readThreadId = (result: unknown): Result<string, Error> =>
  R.fromThrowable(
    () => threadResult.parse(result).thread.id,
    (error) => new Error(`unexpected thread result: ${describeError(error)}`),
  );

const turnResult = z.object({ turn: z.object({ id: z.string() }) });
true satisfies Fits<typeof turnResult, TurnStartResponse>;

export const readTurnId = (result: unknown): Result<string, Error> =>
  R.fromThrowable(
    () => turnResult.parse(result).turn.id,
    (error) =>
      new Error(`unexpected turn/start result: ${describeError(error)}`),
  );

/** imagePaths are the message's images, already written to files in the same order. */
export const turnStartParams = (params: {
  threadId: string;
  message: AgentMessage;
  imagePaths: readonly string[];
}): TurnStartParams => ({
  threadId: params.threadId,
  input: [
    ...params.imagePaths.map((path) => ({ type: "localImage" as const, path })),
    ...(params.message.text
      ? [
          {
            type: "text" as const,
            text: params.message.text,
            text_elements: [],
          },
        ]
      : []),
  ],
});

export enum CodexNoticeKind {
  Events = "events",
  TurnStarted = "turn_started",
  TurnEnded = "turn_ended",
}

export type CodexNotice =
  | { kind: CodexNoticeKind.Events; events: TurnEvent[] }
  | { kind: CodexNoticeKind.TurnStarted; turnId: string }
  /** error is unset unless the turn failed or was interrupted. */
  | {
      kind: CodexNoticeKind.TurnEnded;
      interrupted: boolean;
      error: string | undefined;
    };

const threadNotice = z.looseObject({ threadId: z.string() });

const turnNotice = z.object({
  threadId: z.string(),
  turn: z.object({
    id: z.string(),
    status: z.enum(["completed", "interrupted", "failed", "inProgress"]),
    error: z.object({ message: z.string() }).nullable(),
  }),
});
true satisfies Fits<typeof turnNotice, TurnStartedNotification>;
true satisfies Fits<typeof turnNotice, TurnCompletedNotification>;

const delta = z.object({ threadId: z.string(), delta: z.string() });
true satisfies Fits<typeof delta, AgentMessageDeltaNotification>;

const itemNotice = z.object({
  threadId: z.string(),
  item: z.looseObject({ type: z.string(), id: z.string() }),
});
true satisfies Fits<typeof itemNotice, ItemStartedNotification>;
true satisfies Fits<typeof itemNotice, ItemCompletedNotification>;

const textParts = z
  .array(z.unknown())
  .transform((parts) =>
    parts
      .flatMap((part) =>
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
          ? [part.text]
          : [],
      )
      .join("\n"),
  );

const items = {
  agentMessage: z.object({ type: z.literal("agentMessage"), text: z.string() }),
  commandExecution: z.object({
    type: z.literal("commandExecution"),
    id: z.string(),
    command: z.string(),
    cwd: z.string(),
    status: z.enum(["inProgress", "completed", "failed", "declined"]),
    aggregatedOutput: z.string().nullable(),
    exitCode: z.number().nullable(),
  }),
  fileChange: z.object({
    type: z.literal("fileChange"),
    id: z.string(),
    changes: z.array(
      z.object({ path: z.string(), kind: z.unknown(), diff: z.string() }),
    ),
    status: z.enum(["inProgress", "completed", "failed", "declined"]),
  }),
  mcpToolCall: z.object({
    type: z.literal("mcpToolCall"),
    id: z.string(),
    server: z.string(),
    tool: z.string(),
    arguments: z.unknown(),
    status: z.enum(["inProgress", "completed", "failed"]),
    result: z.object({ content: textParts }).nullable(),
    error: z.object({ message: z.string() }).nullable(),
  }),
  dynamicToolCall: z.object({
    type: z.literal("dynamicToolCall"),
    id: z.string(),
    tool: z.string(),
    arguments: z.unknown(),
    status: z.enum(["inProgress", "completed", "failed"]),
    contentItems: textParts.nullable(),
    success: z.boolean().nullable(),
  }),
};
true satisfies Fits<
  typeof items.agentMessage,
  Extract<ThreadItem, { type: "agentMessage" }>
>;
true satisfies Fits<
  typeof items.commandExecution,
  Extract<ThreadItem, { type: "commandExecution" }>
>;
true satisfies Fits<
  typeof items.fileChange,
  Extract<ThreadItem, { type: "fileChange" }>
>;
true satisfies Fits<
  typeof items.mcpToolCall,
  Extract<ThreadItem, { type: "mcpToolCall" }>
>;
true satisfies Fits<
  typeof items.dynamicToolCall,
  Extract<ThreadItem, { type: "dynamicToolCall" }>
>;

type ToolCall = { name: string; input: unknown };
type ToolResult = { output: string; isError: boolean };

// Items of other types, such as reasoning, plans and web searches, map to no events, as Claude's thinking blocks do.
function toolCall(item: { type: string }): ToolCall | undefined {
  switch (item.type) {
    case "commandExecution": {
      const { command, cwd } = items.commandExecution.parse(item);
      return { name: "command", input: { command, cwd } };
    }
    case "fileChange":
      return {
        name: "edit",
        input: {
          paths: items.fileChange.parse(item).changes.map((c) => c.path),
        },
      };
    case "mcpToolCall": {
      const parsed = items.mcpToolCall.parse(item);
      return {
        name: `${parsed.server}.${parsed.tool}`,
        input: parsed.arguments,
      };
    }
    case "dynamicToolCall": {
      const parsed = items.dynamicToolCall.parse(item);
      return { name: parsed.tool, input: parsed.arguments };
    }
    default:
      return undefined;
  }
}

function toolResult(item: { type: string }): ToolResult | undefined {
  switch (item.type) {
    case "commandExecution": {
      const parsed = items.commandExecution.parse(item);
      return {
        output: parsed.aggregatedOutput ?? "",
        isError: parsed.status !== "completed" || (parsed.exitCode ?? 0) !== 0,
      };
    }
    case "fileChange": {
      const parsed = items.fileChange.parse(item);
      return {
        output: parsed.changes.map((c) => c.diff).join("\n"),
        isError: parsed.status !== "completed",
      };
    }
    case "mcpToolCall": {
      const parsed = items.mcpToolCall.parse(item);
      return {
        output: parsed.error?.message ?? parsed.result?.content ?? "",
        isError: parsed.status !== "completed" || parsed.error !== null,
      };
    }
    case "dynamicToolCall": {
      const parsed = items.dynamicToolCall.parse(item);
      return {
        output: parsed.contentItems ?? "",
        isError: parsed.status !== "completed" || parsed.success === false,
      };
    }
    default:
      return undefined;
  }
}

const noEvents: CodexNotice = { kind: CodexNoticeKind.Events, events: [] };
const events = (list: TurnEvent[]): CodexNotice => ({
  kind: CodexNoticeKind.Events,
  events: list,
});

/** Notifications of a method the adapter doesn't use, or about another thread such as a subagent's, map to no events, so a CLI that adds one keeps working. */
export function readNotification(
  notification: { method: string; params: unknown },
  threadId: string,
): Result<CodexNotice, Error> {
  return R.fromThrowable(
    () => toNotice(notification, threadId),
    (error) =>
      new Error(
        `unexpected ${notification.method} notification: ${describeError(error)}`,
      ),
  );
}

function toNotice(
  { method, params }: { method: string; params: unknown },
  threadId: string,
): CodexNotice {
  const about = threadNotice.safeParse(params);
  if (about.success && about.data.threadId !== threadId) return noEvents;
  switch (method) {
    case "turn/started": {
      return {
        kind: CodexNoticeKind.TurnStarted,
        turnId: turnNotice.parse(params).turn.id,
      };
    }
    case "turn/completed": {
      const parsed = turnNotice.parse(params);
      return {
        kind: CodexNoticeKind.TurnEnded,
        interrupted: parsed.turn.status === "interrupted",
        error:
          parsed.turn.status === "failed" ||
          parsed.turn.status === "interrupted"
            ? (parsed.turn.error?.message ??
              `Codex ended the turn as ${parsed.turn.status}.`)
            : undefined,
      };
    }
    case "item/agentMessage/delta":
      return events([
        {
          kind: AgentEventKind.AssistantTextDelta,
          text: delta.parse(params).delta,
        },
      ]);
    case "item/started": {
      const { item } = itemNotice.parse(params);
      const call = toolCall(item);
      return call
        ? events([
            { kind: AgentEventKind.ToolStarted, toolCallId: item.id, ...call },
          ])
        : noEvents;
    }
    case "item/completed": {
      const { item } = itemNotice.parse(params);
      if (item.type === "agentMessage")
        return events([
          {
            kind: AgentEventKind.AssistantText,
            text: items.agentMessage.parse(item).text,
          },
        ]);
      const result = toolResult(item);
      return result
        ? events([
            {
              kind: AgentEventKind.ToolFinished,
              toolCallId: item.id,
              ...result,
            },
          ])
        : noEvents;
    }
    default:
      return noEvents;
  }
}

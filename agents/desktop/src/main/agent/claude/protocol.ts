import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind, type AgentMessage } from "../session";

export const CLAUDE_CODE_VERSION = "2.1.322";

export const claudeSessionArgs = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  "--dangerously-skip-permissions",
] as const;

export enum ClaudeLineKind {
  Events = "events",
  TurnEnded = "turn_ended",
}

export type TurnEvent = Exclude<AgentEvent, { kind: AgentEventKind.TurnEnded }>;

export type ClaudeLine =
  | { kind: ClaudeLineKind.Events; events: TurnEvent[] }
  /** error is unset for a turn that succeeded. An interrupted turn carries one too. */
  | { kind: ClaudeLineKind.TurnEnded; error: string | undefined };

const typed = z.looseObject({ type: z.string() });
const textBlock = z.object({ type: z.literal("text"), text: z.string() });
const toolUseBlock = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});
const toolResultBlock = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z
    .union([z.string(), z.array(typed)])
    .optional()
    .transform((content) =>
      typeof content === "string"
        ? content
        : (content ?? [])
            .flatMap((part) =>
              typeof part.text === "string" ? [part.text] : [],
            )
            .join("\n"),
    ),
  is_error: z.boolean().optional(),
});

// A subagent's own messages carry its Task call's id here; only the main conversation is shown.
const fromMainConversation = { parent_tool_use_id: z.string().nullable() };

const streamEvent = z.object({
  ...fromMainConversation,
  event: z.looseObject({
    type: z.string(),
    delta: z.looseObject({ type: z.string().optional() }).optional(),
  }),
});
const textDelta = z.object({ type: z.literal("text_delta"), text: z.string() });
const assistant = z.object({
  ...fromMainConversation,
  is_api_error_message: z.boolean().optional(),
  message: z.object({ content: z.array(typed) }),
});
const user = z.object({
  ...fromMainConversation,
  message: z.object({ content: z.union([z.string(), z.array(typed)]) }),
});
const result = z.object({
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

const noEvents: ClaudeLine = { kind: ClaudeLineKind.Events, events: [] };
const events = (list: TurnEvent[]): ClaudeLine => ({
  kind: ClaudeLineKind.Events,
  events: list,
});

const describe = (error: unknown): string =>
  error instanceof z.ZodError
    ? z.prettifyError(error)
    : R.toError(error).message;

/** Lines of a type the adapter doesn't use map to no events, so a CLI that adds one keeps working. */
export function parseClaudeLine(line: string): Result<ClaudeLine, Error> {
  return R.flatMap(
    R.fromThrowable(
      () => typed.parse(JSON.parse(line)),
      (error) => new Error(`not a stream-json event: ${describe(error)}`),
    ),
    (value) =>
      R.fromThrowable(
        () => toClaudeLine(value),
        (error) =>
          new Error(`unexpected ${value.type} event: ${describe(error)}`),
      ),
  );
}

function toClaudeLine(value: { type: string }): ClaudeLine {
  switch (value.type) {
    case "stream_event": {
      const { parent_tool_use_id, event } = streamEvent.parse(value);
      if (parent_tool_use_id !== null || event.type !== "content_block_delta")
        return noEvents;
      if (event.delta?.type !== "text_delta") return noEvents;
      const { text } = textDelta.parse(event.delta);
      return events([{ kind: AgentEventKind.AssistantTextDelta, text }]);
    }
    case "assistant": {
      const { parent_tool_use_id, is_api_error_message, message } =
        assistant.parse(value);
      // An API error's message repeats the error result that ends the turn.
      if (parent_tool_use_id !== null || is_api_error_message) return noEvents;
      return events(message.content.flatMap(assistantEvent));
    }
    case "user": {
      const { parent_tool_use_id, message } = user.parse(value);
      if (parent_tool_use_id !== null || typeof message.content === "string")
        return noEvents;
      return events(
        message.content
          .filter((part) => part.type === "tool_result")
          .map((part) => {
            const parsed = toolResultBlock.parse(part);
            return {
              kind: AgentEventKind.ToolFinished,
              toolCallId: parsed.tool_use_id,
              output: parsed.content,
              isError: parsed.is_error ?? false,
            };
          }),
      );
    }
    case "result": {
      const parsed = result.parse(value);
      return {
        kind: ClaudeLineKind.TurnEnded,
        error: parsed.is_error
          ? parsed.result ||
            parsed.errors?.join("\n") ||
            `Claude Code ended the turn with ${parsed.subtype}.`
          : undefined,
      };
    }
    default:
      return noEvents;
  }
}

function assistantEvent(part: z.infer<typeof typed>): TurnEvent[] {
  switch (part.type) {
    case "text":
      return [
        {
          kind: AgentEventKind.AssistantText,
          text: textBlock.parse(part).text,
        },
      ];
    case "tool_use": {
      const { id, name, input } = toolUseBlock.parse(part);
      return [
        { kind: AgentEventKind.ToolStarted, toolCallId: id, name, input },
      ];
    }
    default:
      return [];
  }
}

export function userMessageLine(message: AgentMessage): string {
  const content = [
    ...message.images.map((image) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: Buffer.from(image.data).toString("base64"),
      },
    })),
    ...(message.text ? [{ type: "text", text: message.text }] : []),
  ];
  return JSON.stringify({ type: "user", message: { role: "user", content } });
}

export function interruptLine(requestId: string): string {
  return JSON.stringify({
    type: "control_request",
    request_id: requestId,
    request: { subtype: "interrupt" },
  });
}

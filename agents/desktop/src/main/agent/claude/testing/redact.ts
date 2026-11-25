import { z } from "zod";
import { R } from "../../../../../../../common/src/result";
import { AgentEventKind } from "../../../../shared/agent-event";
import {
  checkReadings,
  machineRules,
  redactLines,
  type Machine,
  type StreamedLine,
} from "../../testing/redact-lines";
import { ClaudeLineKind, parseClaudeLine } from "../protocol";
import { CaptureRecordKind, readCaptureLine, stdinShape } from "./capture";

// 2.1.322 names a connector's server "claude.ai <Name>", and its `source` field is optional.
const connectorMarkers = ["claude_ai", "claudeai", "claude.ai "];
const isConnector = (value: unknown): boolean =>
  typeof value === "string"
    ? value.startsWith("mcp__claude_ai_")
    : typeof value === "object" &&
      value !== null &&
      (("source" in value && value.source === "claudeai") ||
        ("name" in value &&
          typeof value.name === "string" &&
          value.name.startsWith("claude.ai ")));

function withoutConnectors(value: unknown): unknown {
  if (Array.isArray(value))
    return value.filter((item) => !isConnector(item)).map(withoutConnectors);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        withoutConnectors(item),
      ]),
    );
  return value;
}

const deltaTextKey: Record<string, string> = {
  text_delta: "text",
  input_json_delta: "partial_json",
  thinking_delta: "thinking",
};
const streamEvent = z.object({
  type: z.literal("stream_event"),
  parent_tool_use_id: z.string().nullable(),
  event: z.object({
    type: z.string(),
    index: z.number(),
    delta: z.record(z.string(), z.unknown()).optional(),
  }),
});
function streamedLine(stdout: string): StreamedLine | undefined {
  const parsed = R.fromThrowable(() => streamEvent.parse(JSON.parse(stdout)));
  if (!parsed.ok) return undefined;
  const { event, parent_tool_use_id } = parsed.value;
  const key = deltaTextKey[String(event.delta?.type)];
  const text = key === undefined ? undefined : event.delta?.[key];
  return {
    block: `${parent_tool_use_id}:${event.index}`,
    startsBlock: event.type === "content_block_start",
    fragment:
      key !== undefined && typeof text === "string" ? { key, text } : undefined,
  };
}

/** Replaces the recording machine's paths and account name, and drops the recording account's claude.ai connectors and their tools from every stdout line. Throws when a line isn't a capture record, redaction changes what the adapter or the test stub reads, or a line still mentions claude.ai. */
export function redactCapture(content: string, machine: Machine): string {
  const original = content.split("\n");
  // Connectors go before redaction, which could break their markers when the account name is a word in them, such as "ai".
  const withoutAccountConnectors = original.map((line, index) => {
    if (!connectorMarkers.some((marker) => line.includes(marker))) return line;
    const read = R.fromThrowable(() => {
      const record = readCaptureLine(line);
      return record.kind === CaptureRecordKind.Out
        ? JSON.stringify({
            ...record,
            text: JSON.stringify(withoutConnectors(JSON.parse(record.text))),
          })
        : line;
    });
    if (!read.ok)
      throw new Error(
        `line ${index + 1} mentions claude.ai but isn't a capture record with JSON stdout`,
        { cause: read.error },
      );
    const cleaned = read.value;
    if (connectorMarkers.some((marker) => cleaned.includes(marker)))
      throw new Error(
        `line ${index + 1} still mentions claude.ai after its connectors were dropped: either the recorded session called one, so re-record without it, or other text names claude.ai, so check the line`,
      );
    return cleaned;
  });
  const replaced = redactLines({
    lines: withoutAccountConnectors,
    rules: machineRules(machine),
    streamedLine,
  });
  checkReadings({
    original,
    redacted: replaced,
    reading,
    account: machine.account,
  });
  return replaced.join("\n");
}

// What the adapter or the test stub reads from a line: a start record's arguments, a stdin line's shape, and the event kinds and tool names the parser reads from stdout, leaving out text a redaction may rightly change.
function reading(line: string): string {
  if (!line) return "";
  const record = readCaptureLine(line);
  switch (record.kind) {
    case CaptureRecordKind.Start:
      return JSON.stringify(record.args);
    case CaptureRecordKind.In:
      return `in ${stdinShape(record.text)}`;
    case CaptureRecordKind.Out:
      return stdoutReading(record.text);
    case CaptureRecordKind.Stderr:
    case CaptureRecordKind.StdinClosed:
    case CaptureRecordKind.Exit:
      return record.kind;
    default:
      throw new Error(`unknown record: ${record satisfies never}`);
  }
}

function stdoutReading(text: string): string {
  const parsed = parseClaudeLine(text);
  if (!parsed.ok) return "unreadable";
  switch (parsed.value.kind) {
    case ClaudeLineKind.Events:
      return JSON.stringify(
        parsed.value.events.map((event) =>
          event.kind === AgentEventKind.ToolStarted
            ? `${event.kind} ${event.name}`
            : event.kind,
        ),
      );
    case ClaudeLineKind.TurnEnded:
      return `turn ended${parsed.value.error === undefined ? "" : " with an error"}`;
    case ClaudeLineKind.MessageRead:
      return "message read";
    default:
      throw new Error(`unknown line kind: ${parsed.value satisfies never}`);
  }
}

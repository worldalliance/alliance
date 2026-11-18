import { z } from "zod";
import { R } from "../../../../../../../common/src/result";
import { AgentEventKind } from "../../../../shared/agent-event";
import {
  CaptureRecordKind,
  readCaptureLine,
} from "../../testing/capture-record";
import {
  checkReadings,
  escapeRegExp,
  type Machine,
  machineRules,
  redactLines,
  type Rule,
  type StreamedLine,
} from "../../testing/redact-lines";
import { CodexNoticeKind, readNotification } from "../protocol";
import { stdinShape } from "./capture";

const personalMethods = new Set([
  "account/updated",
  "account/rateLimits/updated",
  "remoteControl/status/changed",
]);

const message = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  error: z.unknown().optional(),
});
const streamedDelta = z.object({ itemId: z.string(), delta: z.string() });
const threadOf = z.looseObject({ threadId: z.string() });

function streamedLine(stdout: string): StreamedLine | undefined {
  const parsed = R.fromThrowable(() => message.parse(JSON.parse(stdout)));
  if (!parsed.ok || !parsed.value.method?.toLowerCase().endsWith("delta"))
    return undefined;
  const delta = streamedDelta.safeParse(parsed.value.params);
  if (!delta.success) return undefined;
  return {
    block: `${parsed.value.method}:${delta.data.itemId}`,
    startsBlock: false,
    fragment: { key: "delta", text: delta.data.delta },
  };
}

const methodOf = (line: string): string | undefined => {
  const record = readCaptureLine(line);
  if (record.kind !== CaptureRecordKind.Out) return undefined;
  const parsed = R.fromThrowable(() => message.parse(JSON.parse(record.text)));
  return parsed.ok ? parsed.value.method : undefined;
};

/** Drops the stdout notifications holding the account's plan and usage or the machine's hostname and installation id, replaces the hostname and the temporary folder wherever else they appear, and the recording machine's paths and account name as Claude's captures do. Throws when a line isn't a capture record, or redaction changes what the adapter or the test stub reads. */
export function redactCapture(
  content: string,
  machine: Machine & { hostname: string; tmpdir: string },
): string {
  const kept = content
    .split("\n")
    .filter((line) => !line || !personalMethods.has(methodOf(line) ?? ""));
  const rules: Rule[] = [
    [new RegExp(escapeRegExp(machine.hostname), "g"), "host"],
    // The adapter saves a message's images in the temporary folder, whose path is per user.
    [new RegExp(escapeRegExp(machine.tmpdir), "g"), "/tmp"],
    ...machineRules(machine),
  ];
  const redacted = redactLines({ lines: kept, rules, streamedLine });
  checkReadings({
    original: kept,
    redacted,
    reading,
    account: machine.account,
  });
  return redacted.join("\n");
}

// What the adapter or the test stub reads from a line: a start record's arguments, a stdin line's shape, and from stdout a response's outcome or the events and tool names a notification maps to, leaving out text a redaction may rightly change.
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
  const parsed = R.fromThrowable(() => message.parse(JSON.parse(text)));
  if (!parsed.ok) return "unreadable";
  const { id, method, params, error } = parsed.value;
  if (method === undefined)
    return `response ${id} ${error === undefined ? "ok" : "error"}`;
  const thread = threadOf.safeParse(params);
  const notice = readNotification(
    { method, params },
    thread.success ? thread.data.threadId : "",
  );
  if (!notice.ok) return `${method} unreadable`;
  switch (notice.value.kind) {
    case CodexNoticeKind.Events:
      return `${method} ${JSON.stringify(
        notice.value.events.map((event) =>
          event.kind === AgentEventKind.ToolStarted
            ? `${event.kind} ${event.name}`
            : event.kind,
        ),
      )}`;
    case CodexNoticeKind.TurnStarted:
      return "turn started";
    case CodexNoticeKind.TurnEnded:
      return `turn ended${notice.value.interrupted ? " interrupted" : ""}${notice.value.error === undefined ? "" : " with an error"}`;
    default:
      throw new Error(`unknown notice kind: ${notice.value satisfies never}`);
  }
}

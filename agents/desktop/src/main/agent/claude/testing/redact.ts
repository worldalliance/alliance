import { z } from "zod";
import { R } from "../../../../../../../common/src/result";
import { AgentEventKind } from "../../session";
import { ClaudeLineKind, parseClaudeLine } from "../protocol";
import { CaptureRecordKind, readCaptureLine, stdinShape } from "./capture";

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
type Fragment = { line: number; key: string; text: string };
type Rule = [pattern: RegExp, replacement: string];

// Applies one rule to a block's joined text and moves each fragment's end with it: a replacement belongs to the fragment its match starts in, so fragments the match doesn't cover keep their text.
function redactKeepingEnds(
  block: { text: string; ends: number[] },
  [pattern, replacement]: Rule,
): { text: string; ends: number[] } {
  const matches: { start: number; length: number }[] = [];
  const text = block.text.replace(pattern, (match: string, start: number) => {
    matches.push({ start, length: match.length });
    return replacement;
  });
  const ends = block.ends.map((end) => {
    let shift = 0;
    for (const { start, length } of matches) {
      if (end <= start) break;
      if (end < start + length) return start + shift + replacement.length;
      shift += replacement.length - length;
    }
    return end + shift;
  });
  return { text, ends };
}

// JSON escapes hide word starts, as a name after \u0007 follows a hex digit, so the rules run on decoded strings and keys: a capture record's, and those of the stdout or stdin line its text holds. A string is rewritten only when its redaction changes it.
function redactDecoded(params: {
  text: string;
  redact: (text: string) => string;
  depth: number;
}): string {
  const { text, redact, depth } = params;
  const parsed = R.fromThrowable(() => JSON.parse(text));
  if (!parsed.ok) return redact(text);
  const walk = (value: unknown): unknown => {
    if (typeof value === "string")
      return depth > 1
        ? redactDecoded({ text: value, redact, depth: depth - 1 })
        : redact(value);
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === "object" && value !== null) {
      const entries = new Map<string, { key: string; item: unknown }>();
      for (const [key, item] of Object.entries(value)) {
        const redactedKey = redact(key);
        const earlier = entries.get(redactedKey);
        if (earlier)
          throw new Error(
            `keys ${earlier.key} and ${key} both redact to ${redactedKey}`,
          );
        entries.set(redactedKey, { key, item: walk(item) });
      }
      return Object.fromEntries(
        [...entries].map(([redactedKey, { item }]) => [redactedKey, item]),
      );
    }
    return value;
  };
  const redacted = JSON.stringify(walk(parsed.value));
  return redacted === JSON.stringify(parsed.value) ? text : redacted;
}

// A content block streams its text in fragments, one per line, and stderr arrives in arbitrary chunks, so a path can span lines that each look harmless; this redacts each block's joined text, and all of stderr's. Fragments come from the unredacted lines, since redacting a fragment on its own can cut a path short where it ends.
function redactStreamedText(lines: string[], rules: Rule[]): string[] {
  const redact = (text: string) =>
    rules.reduce(
      (t, [pattern, replacement]) => t.replace(pattern, replacement),
      text,
    );
  // Only stdout and stdin text is a stream-json line; stderr is raw text, which a JSON round trip would reformat.
  const result = lines.map((line) => {
    const record = R.fromThrowable(() => readCaptureLine(line));
    if (!record.ok || record.value.kind !== CaptureRecordKind.Stderr)
      return redactDecoded({ text: line, redact, depth: 2 });
    const text = redact(record.value.text);
    return text === record.value.text
      ? line
      : JSON.stringify({ ...record.value, text });
  });
  const rewrite = (fragment: Fragment, text: string) => {
    const lineRedacted = redact(fragment.text);
    if (text === lineRedacted) return;
    const record = readCaptureLine(result[fragment.line]);
    if (record.kind === CaptureRecordKind.Stderr) {
      result[fragment.line] = JSON.stringify({ ...record, text });
      return;
    }
    if (record.kind !== CaptureRecordKind.Out) return;
    const field = (value: string) =>
      `${JSON.stringify(fragment.key)}:${JSON.stringify(value)}`;
    const rewritten = record.text.replace(field(lineRedacted), () =>
      field(text),
    );
    if (!rewritten.includes(field(text)))
      throw new Error(
        `line ${fragment.line + 1} doesn't write its delta text as JSON.stringify does`,
      );
    result[fragment.line] = JSON.stringify({ ...record, text: rewritten });
  };
  const redactBlock = (fragments: Fragment[]) => {
    let end = 0;
    const ends = fragments.map((fragment) => (end += fragment.text.length));
    const redacted = rules.reduce(
      (block, rule) => redactKeepingEnds(block, rule),
      { text: fragments.map((fragment) => fragment.text).join(""), ends },
    );
    fragments.forEach((fragment, index) =>
      rewrite(
        fragment,
        redacted.text.slice(
          redacted.ends[index - 1] ?? 0,
          redacted.ends[index],
        ),
      ),
    );
  };
  const blocks = new Map<string, Fragment[]>();
  lines.forEach((line, index) => {
    const record = R.fromThrowable(() => readCaptureLine(line));
    if (record.ok && record.value.kind === CaptureRecordKind.Stderr) {
      const fragment = { line: index, key: "text", text: record.value.text };
      blocks.set("stderr", [...(blocks.get("stderr") ?? []), fragment]);
      return;
    }
    if (!record.ok || record.value.kind !== CaptureRecordKind.Out) return;
    const text = record.value.text;
    const parsed = R.fromThrowable(() => streamEvent.parse(JSON.parse(text)));
    if (!parsed.ok) return;
    const { event, parent_tool_use_id } = parsed.value;
    const block = `${parent_tool_use_id}:${event.index}`;
    if (event.type === "content_block_start") {
      redactBlock(blocks.get(block) ?? []);
      blocks.set(block, []);
    }
    const key = deltaTextKey[String(event.delta?.type)];
    const fragment = key === undefined ? undefined : event.delta?.[key];
    if (key !== undefined && typeof fragment === "string")
      blocks.get(block)?.push({ line: index, key, text: fragment });
  });
  blocks.forEach(redactBlock);
  return result;
}

/** Replaces the recording machine's paths and account name, and drops the recording account's claude.ai connectors and their tools from every stdout line. Throws when a line isn't a capture record, redaction changes what the adapter or the test stub reads, or a line still mentions claude.ai. */
export function redactCapture(
  content: string,
  machine: {
    repo: string;
    mainCheckout: string;
    home: string;
    account: string;
  },
): string {
  // Only whole words, so the name can't rewrite part of a longer word. Streamed tool input is JSON text, so after a backslash only a whole escape such as \n or \u0007 ends the word before; so does a terminal control sequence, raw or escaped, though it ends in a letter.
  const accountName = new RegExp(
    `(?<=^|[^\\\\\\w]|\\\\[nrtbf"/\\\\]|\\\\u[\\da-fA-F]{4}|(?:\\x1b|\\\\u001b)\\[[\\x30-\\x3f]*[\\x20-\\x2f]*[\\x40-\\x7e])${escapeRegExp(machine.account)}(?!\\w)`,
    "g",
  );
  // A path counts only where it ends, a full stop ending a sentence included, so a longer path that starts with it keeps its own name.
  const wholePath = (path: string) =>
    new RegExp(`${escapeRegExp(path)}(?![\\w-]|\\.[\\w-])`, "g");
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
  const replaced = redactStreamedText(withoutAccountConnectors, [
    [wholePath(machine.repo), "/repo"],
    [wholePath(machine.mainCheckout), "/repo"],
    [wholePath(machine.home), "/home/user"],
    [accountName, "user"],
  ]);
  replaced.forEach((line, index) => {
    const before = R.fromThrowable(() => reading(original[index]));
    if (!before.ok)
      throw new Error(`line ${index + 1} isn't a capture record`, {
        cause: before.error,
      });
    const after = R.fromThrowable(() => reading(line));
    if (!after.ok || after.value !== before.value)
      throw new Error(
        `redacting line ${index + 1} changed what the adapter reads from it, from ${before.value} to ${after.ok ? after.value : "an unreadable line"}; a path rule, or the account name ${machine.account} as a word the CLI's output uses, may have caused it`,
        { cause: after.ok ? undefined : after.error },
      );
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
    default:
      throw new Error(`unknown line kind: ${parsed.value satisfies never}`);
  }
}

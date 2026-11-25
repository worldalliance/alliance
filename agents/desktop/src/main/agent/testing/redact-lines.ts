import { R } from "../../../../../../common/src/result";
import { CaptureRecordKind, readCaptureLine } from "./capture-record";

export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Fragment = { line: number; key: string; text: string };
export type Rule = [pattern: RegExp, replacement: string];

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

/** A stdout line's place in a streamed text: the block it belongs to, whether it starts that block afresh, and the fragment it extends it by, under the JSON key holding it. */
export type StreamedLine = {
  block: string;
  startsBlock: boolean;
  fragment?: { key: string; text: string };
};

/** Applies rules to every decoded string of each capture line, and to streamed text and stderr as joined across lines, since a path can span lines that each look harmless. Fragments come from the unredacted lines, since redacting a fragment on its own can cut a path short where it ends. */
export function redactLines(params: {
  lines: string[];
  rules: Rule[];
  streamedLine: (stdout: string) => StreamedLine | undefined;
}): string[] {
  const { lines, rules, streamedLine } = params;
  const redact = (text: string) =>
    rules.reduce(
      (t, [pattern, replacement]) => t.replace(pattern, replacement),
      text,
    );
  // Stdout and stdin text is a JSON line; stderr is raw text, which a JSON round trip would reformat.
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
    const streamed = streamedLine(record.value.text);
    if (!streamed) return;
    if (streamed.startsBlock) {
      redactBlock(blocks.get(streamed.block) ?? []);
      blocks.set(streamed.block, []);
    }
    if (streamed.fragment)
      blocks.set(streamed.block, [
        ...(blocks.get(streamed.block) ?? []),
        { line: index, ...streamed.fragment },
      ]);
  });
  blocks.forEach(redactBlock);
  return result;
}

export type Machine = {
  repo: string;
  mainCheckout: string;
  home: string;
  account: string;
};

/** The recording machine's repository and main checkout become /repo, its home folder /home/user, and its account name, as a whole word, user. */
export function machineRules(machine: Machine): Rule[] {
  // Only whole words, so the name can't rewrite part of a longer word. Streamed tool input is JSON text, so after a backslash only a whole escape such as \n or \u0007 ends the word before; so does a terminal control sequence, raw or escaped, though it ends in a letter.
  const accountName = new RegExp(
    `(?<=^|[^\\\\\\w]|\\\\[nrtbf"/\\\\]|\\\\u[\\da-fA-F]{4}|(?:\\x1b|\\\\u001b)\\[[\\x30-\\x3f]*[\\x20-\\x2f]*[\\x40-\\x7e])${escapeRegExp(machine.account)}(?!\\w)`,
    "g",
  );
  // A path counts only where it ends, a full stop ending a sentence included, so a longer path that starts with it keeps its own name.
  const wholePath = (path: string) =>
    new RegExp(`${escapeRegExp(path)}(?![\\w-]|\\.[\\w-])`, "g");
  return [
    [wholePath(machine.repo), "/repo"],
    [wholePath(machine.mainCheckout), "/repo"],
    [wholePath(machine.home), "/home/user"],
    [accountName, "user"],
  ];
}

/** Throws unless each redacted line reads, for the adapter and the test stub, as its original did. */
export function checkReadings(params: {
  original: string[];
  redacted: string[];
  reading: (line: string) => string;
  account: string;
}): void {
  const { original, redacted, reading, account } = params;
  redacted.forEach((line, index) => {
    const before = R.fromThrowable(() => reading(original[index]));
    if (!before.ok)
      throw new Error(`line ${index + 1} isn't a capture record`, {
        cause: before.error,
      });
    const after = R.fromThrowable(() => reading(line));
    if (!after.ok || after.value !== before.value)
      throw new Error(
        `redacting line ${index + 1} changed what the adapter reads from it, from ${before.value} to ${after.ok ? after.value : "an unreadable line"}; a path rule, or the account name ${account} as a word the CLI's output uses, may have caused it`,
        { cause: after.ok ? undefined : after.error },
      );
  });
}

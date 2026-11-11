import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CLAUDE_CODE_VERSION } from "../protocol";
import { CaptureRecordKind, captureDir, readCapture } from "./capture";

const dir = captureDir(CLAUDE_CODE_VERSION);
const files = readdirSync(dir).filter((file) => file.endsWith(".jsonl"));

test("the captures folder holds captures", () => {
  expect(files).not.toBeEmpty();
});

test.each(files)("%s is one recorded CLI process", (file) => {
  const records = readCapture(path.join(dir, file));
  expect(records[0]?.kind).toBe(CaptureRecordKind.Start);
  expect(records.at(-1)?.kind).toBe(CaptureRecordKind.Exit);
});

const streamEvent = z.object({
  type: z.literal("stream_event"),
  event: z.object({
    index: z.number(),
    content_block: z
      .object({ type: z.string(), id: z.string().optional() })
      .optional(),
    delta: z
      .object({
        partial_json: z.string(),
        text: z.string(),
        thinking: z.string(),
      })
      .partial()
      .optional(),
  }),
});
const contentBlock = z.object({
  type: z.string(),
  id: z.string().optional(),
  input: z.unknown().optional(),
  text: z.string().optional(),
  thinking: z.string().optional(),
});
const assistant = z.object({
  type: z.literal("assistant"),
  message: z.object({ content: z.array(contentBlock) }),
});

const sessions = files.filter((file) => file.endsWith("-session.jsonl"));

type Streamed = { type: string; id?: string; text: string };
type ContentBlock = {
  recorded: z.infer<typeof contentBlock>;
  streamed: Streamed | undefined;
};

function contentBlocks(file: string): ContentBlock[] {
  const streamed = new Map<number, Streamed>();
  const blocks: ContentBlock[] = [];
  for (const record of readCapture(path.join(dir, file))) {
    if (record.kind !== CaptureRecordKind.Out) continue;
    const line: unknown = JSON.parse(record.text);
    const stream = streamEvent.safeParse(line);
    if (stream.success) {
      const { index, content_block, delta } = stream.data.event;
      if (content_block) {
        // Deleting first keeps the map in start order, which the lookup below relies on.
        streamed.delete(index);
        streamed.set(index, { ...content_block, text: "" });
      }
      const block = streamed.get(index);
      if (block && delta)
        block.text += delta.partial_json ?? delta.text ?? delta.thinking ?? "";
    }
    for (const recorded of assistant.safeParse(line).data?.message.content ??
      [])
      blocks.push({
        recorded,
        streamed: [...streamed.values()].findLast(
          (b) =>
            b.type === recorded.type &&
            (recorded.id === undefined || b.id === recorded.id),
        ),
      });
  }
  return blocks;
}

test("the captures stream a tool call", () => {
  expect(
    sessions
      .flatMap(contentBlocks)
      .filter((block) => block.recorded.type === "tool_use"),
  ).not.toBeEmpty();
});

// A redaction of whole lines misses a path a content block streams across several lines.
test.each(sessions)("%s streams each content block as recorded", (file) => {
  for (const { recorded, streamed } of contentBlocks(file)) {
    if (!streamed)
      throw new Error(`${file}: ${recorded.type} block not streamed`);
    if (recorded.type === "tool_use")
      expect(recorded.input).toMatchObject(
        z.record(z.string(), z.unknown()).parse(JSON.parse(streamed.text)),
      );
    else expect(streamed.text).toBe(recorded.text ?? recorded.thinking ?? "");
  }
});

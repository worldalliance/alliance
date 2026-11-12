import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { AgentEventKind } from "../../../shared/agent-event";
import { ImageMediaType } from "../session";
import {
  CLAUDE_CODE_VERSION,
  ClaudeLineKind,
  interruptLine,
  parseClaudeLine,
  userMessageLine,
} from "./protocol";
import { CaptureRecordKind, captureDir, readCapture } from "./testing/capture";

const line = (value: unknown) => parseClaudeLine(JSON.stringify(value));
const main = { parent_tool_use_id: null };

describe(`captures of Claude Code ${CLAUDE_CODE_VERSION}`, () => {
  const dir = captureDir(CLAUDE_CODE_VERSION);
  const sessions = readdirSync(dir).filter((file) =>
    file.endsWith("-session.jsonl"),
  );

  test.each(sessions)("%s parses line by line", (file) => {
    const out = readCapture(path.join(dir, file)).flatMap((entry) =>
      entry.kind === CaptureRecordKind.Out ? [entry.text] : [],
    );
    expect(out.length).toBeGreaterThan(0);
    for (const text of out)
      expect(parseClaudeLine(text)).toMatchObject({ ok: true });
  });
});

describe("parseClaudeLine", () => {
  test("maps a text delta from the main conversation", () => {
    expect(
      line({
        type: "stream_event",
        ...main,
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hi" },
        },
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.Events,
        events: [{ kind: AgentEventKind.AssistantTextDelta, text: "Hi" }],
      }),
    );
  });

  test.each([
    {
      type: "assistant",
      message: { content: [{ type: "text", text: "inner" }] },
    },
    {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "inner" },
      },
    },
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }],
      },
    },
  ])("ignores a subagent's $type line", (value) => {
    expect(line({ ...value, parent_tool_use_id: "toolu_1" })).toEqual(
      R.success({ kind: ClaudeLineKind.Events, events: [] }),
    );
  });

  test("leaves an API error's message to the turn's error result", () => {
    expect(
      line({
        type: "assistant",
        ...main,
        is_api_error_message: true,
        message: { content: [{ type: "text", text: "API Error: 529" }] },
      }),
    ).toEqual(R.success({ kind: ClaudeLineKind.Events, events: [] }));
  });

  test("maps text and tool use blocks, skipping thinking", () => {
    expect(
      line({
        type: "assistant",
        ...main,
        message: {
          content: [
            { type: "thinking", thinking: "", signature: "x" },
            { type: "text", text: "Reading" },
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { file_path: "a" },
            },
          ],
        },
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.Events,
        events: [
          { kind: AgentEventKind.AssistantText, text: "Reading" },
          {
            kind: AgentEventKind.ToolStarted,
            toolCallId: "t1",
            name: "Read",
            input: { file_path: "a" },
          },
        ],
      }),
    );
  });

  test("joins a tool result's text parts and keeps its error flag", () => {
    expect(
      line({
        type: "user",
        ...main,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "t1",
              is_error: true,
              content: [
                { type: "text", text: "one" },
                { type: "image" },
                { type: "text", text: "two" },
              ],
            },
          ],
        },
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.Events,
        events: [
          {
            kind: AgentEventKind.ToolFinished,
            toolCallId: "t1",
            output: "one\ntwo",
            isError: true,
          },
        ],
      }),
    );
  });

  test("takes a tool result's string content as its output", () => {
    expect(
      line({
        type: "user",
        ...main,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "done" },
          ],
        },
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.Events,
        events: [
          {
            kind: AgentEventKind.ToolFinished,
            toolCallId: "t1",
            output: "done",
            isError: false,
          },
        ],
      }),
    );
  });

  test("ends the turn, with the CLI's errors when it failed", () => {
    expect(
      line({ type: "result", subtype: "success", is_error: false }),
    ).toEqual(R.success({ kind: ClaudeLineKind.TurnEnded, error: undefined }));
    expect(
      line({
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        errors: ["No conversation found"],
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.TurnEnded,
        error: "No conversation found",
      }),
    );
    expect(
      line({
        type: "result",
        subtype: "success",
        is_error: true,
        result: "API Error: 529 Overloaded",
        errors: ["ignored"],
      }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.TurnEnded,
        error: "API Error: 529 Overloaded",
      }),
    );
    expect(
      line({ type: "result", subtype: "error_max_turns", is_error: true }),
    ).toEqual(
      R.success({
        kind: ClaudeLineKind.TurnEnded,
        error: "Claude Code ended the turn with error_max_turns.",
      }),
    );
  });

  test("ignores event types it doesn't use", () => {
    expect(line({ type: "rate_limit_event" })).toEqual(
      R.success({ kind: ClaudeLineKind.Events, events: [] }),
    );
  });

  test("fails on a line that isn't JSON or a used event of the wrong shape", () => {
    expect(parseClaudeLine("not json").ok).toBe(false);
    expect(line({ type: "assistant", ...main, message: {} })).toEqual(
      R.failure(
        new Error(
          "unexpected assistant event: ✖ Invalid input: expected array, received undefined\n  → at message.content",
        ),
      ),
    );
  });
});

test("userMessageLine sends images as base64 blocks before the text", () => {
  expect(
    JSON.parse(
      userMessageLine({
        text: "What's this?",
        images: [
          { mediaType: ImageMediaType.Png, data: new Uint8Array([1, 2, 3]) },
        ],
      }),
    ),
  ).toEqual({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "AQID" },
        },
        { type: "text", text: "What's this?" },
      ],
    },
  });
});

test("userMessageLine leaves out the text block when there is no text", () => {
  expect(
    JSON.parse(
      userMessageLine({
        text: "",
        images: [
          { mediaType: ImageMediaType.Png, data: new Uint8Array([1, 2, 3]) },
        ],
      }),
    ).message.content,
  ).toEqual([
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AQID" },
    },
  ]);
});

test("interruptLine asks the CLI to interrupt the running turn", () => {
  expect(JSON.parse(interruptLine("r1"))).toEqual({
    type: "control_request",
    request_id: "r1",
    request: { subtype: "interrupt" },
  });
});

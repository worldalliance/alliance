import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { R } from "../../../../../../common/src/result";
import { AgentEventKind } from "../../../shared/agent-event";
import { ImageMediaType } from "../session";
import { CaptureRecordKind, readCapture } from "../testing/capture-record";
import {
  type CodexNotice,
  CodexNoticeKind,
  readNotification,
  threadResumeParams,
  threadStartParams,
  turnStartParams,
} from "./protocol";
import { captureDir } from "./testing/capture";
import { CODEX_VERSION } from "./version";

const thread = "t";
const notice = (method: string, params: unknown) =>
  R.unwrap(readNotification({ method, params }, thread));
const capturedMessage = z.looseObject({
  method: z.string().optional(),
  params: z.looseObject({ threadId: z.string().optional() }).optional(),
});
const item = (method: string, value: Record<string, unknown>) =>
  notice(method, { threadId: thread, turnId: "u", item: value });

describe("the captures", () => {
  const dir = captureDir(CODEX_VERSION);
  const lines = readdirSync(dir)
    .filter((file) => file.endsWith("-session.jsonl"))
    .flatMap((file) =>
      readCapture(path.join(dir, file)).flatMap((record) =>
        record.kind === CaptureRecordKind.Out ? [record.text] : [],
      ),
    );

  test("hold notifications of every kind the adapter maps", () => {
    const methods = new Set(
      lines.flatMap((line) => {
        const parsed = capturedMessage.parse(JSON.parse(line));
        return parsed.method ? [parsed.method] : [];
      }),
    );
    for (const method of [
      "turn/started",
      "turn/completed",
      "item/started",
      "item/completed",
      "item/agentMessage/delta",
    ])
      expect(methods).toContain(method);
  });

  test("read without error", () => {
    for (const line of lines) {
      const message = capturedMessage.parse(JSON.parse(line));
      if (!message.method) continue;
      const read = readNotification(
        { method: message.method, params: message.params },
        message.params?.threadId ?? thread,
      );
      expect(read.ok ? "ok" : read.error.message).toBe("ok");
    }
  });

  test("stream each message's deltas to the text it completes with", () => {
    const deltas = new Map<string, string>();
    const completed = new Map<string, string>();
    for (const line of lines) {
      const { method, params } = JSON.parse(line);
      if (method === "item/agentMessage/delta")
        deltas.set(
          params.itemId,
          (deltas.get(params.itemId) ?? "") + params.delta,
        );
      if (method === "item/completed" && params.item.type === "agentMessage")
        completed.set(params.item.id, params.item.text);
    }
    expect(completed.size).toBeGreaterThan(0);
    for (const [id, streamed] of deltas)
      if (completed.has(id)) expect(streamed).toBe(completed.get(id) ?? "");
  });
});

describe("readNotification", () => {
  test("maps text, its deltas and the turn's ends", () => {
    expect(
      notice("item/agentMessage/delta", {
        threadId: thread,
        itemId: "m",
        delta: "Hi",
      }),
    ).toEqual({
      kind: CodexNoticeKind.Events,
      events: [{ kind: AgentEventKind.AssistantTextDelta, text: "Hi" }],
    });
    expect(
      item("item/completed", { type: "agentMessage", id: "m", text: "Hi" }),
    ).toEqual({
      kind: CodexNoticeKind.Events,
      events: [{ kind: AgentEventKind.AssistantText, text: "Hi" }],
    });
    const ended = (status: string, error: unknown = null) =>
      notice("turn/completed", {
        threadId: thread,
        turn: { id: "u", status, error },
      });
    expect(ended("completed")).toEqual({
      kind: CodexNoticeKind.TurnEnded,
      interrupted: false,
      error: undefined,
    });
    expect(ended("interrupted")).toEqual({
      kind: CodexNoticeKind.TurnEnded,
      interrupted: true,
      error: "Codex ended the turn as interrupted.",
    });
    expect(ended("interrupted", { message: "usage limit" })).toMatchObject({
      error: "usage limit",
    });
    expect(ended("failed", { message: "boom" })).toMatchObject({
      error: "boom",
    });
    expect(ended("failed")).toMatchObject({
      error: "Codex ended the turn as failed.",
    });
  });

  test("maps each tool item to a start and a finish", () => {
    const command = {
      type: "commandExecution",
      id: "c",
      command: "ls",
      cwd: "/repo",
      status: "completed",
      aggregatedOutput: "a.txt\n",
      exitCode: 0,
    };
    expect(item("item/started", command)).toMatchObject({
      events: [
        {
          kind: AgentEventKind.ToolStarted,
          toolCallId: "c",
          name: "command",
          input: { command: "ls", cwd: "/repo" },
        },
      ],
    });
    expect(item("item/completed", command)).toMatchObject({
      events: [{ output: "a.txt\n", isError: false }],
    });
    expect(item("item/completed", { ...command, exitCode: 1 })).toMatchObject({
      events: [{ isError: true }],
    });
    const edit = {
      type: "fileChange",
      id: "f",
      changes: [{ path: "a.txt", kind: { type: "update" }, diff: "-a\n+b" }],
      status: "failed",
    };
    expect(item("item/started", edit)).toMatchObject({
      events: [{ name: "edit", input: { paths: ["a.txt"] } }],
    });
    expect(item("item/completed", edit)).toMatchObject({
      events: [{ output: "-a\n+b", isError: true }],
    });
    const mcp = {
      type: "mcpToolCall",
      id: "m",
      server: "linear",
      tool: "search",
      arguments: { q: 1 },
      status: "completed",
      result: { content: [{ type: "text", text: "found" }] },
      error: null,
    };
    expect(item("item/started", mcp)).toMatchObject({
      events: [{ name: "linear.search", input: { q: 1 } }],
    });
    expect(item("item/completed", mcp)).toMatchObject({
      events: [{ output: "found", isError: false }],
    });
    const dynamic = {
      type: "dynamicToolCall",
      id: "d",
      tool: "lookup",
      arguments: {},
      status: "completed",
      contentItems: [{ type: "inputText", text: "x" }],
      success: false,
    };
    expect(item("item/completed", dynamic)).toMatchObject({
      events: [{ output: "x", isError: true }],
    });
  });

  test("leaves out other threads, other item types and other methods", () => {
    const none: CodexNotice = { kind: CodexNoticeKind.Events, events: [] };
    expect(
      R.unwrap(
        readNotification(
          {
            method: "turn/completed",
            params: { threadId: "subagent", turn: { id: "t" } },
          },
          thread,
        ),
      ),
    ).toEqual(none);
    expect(item("item/started", { type: "reasoning", id: "r" })).toEqual(none);
    expect(notice("thread/tokenUsage/updated", {})).toEqual(none);
  });

  test("fails on a mapped notification in an unexpected shape", () => {
    const read = readNotification(
      { method: "turn/completed", params: { threadId: thread } },
      thread,
    );
    expect(read.ok).toBe(false);
    if (!read.ok)
      expect(read.error.message).toStartWith(
        "unexpected turn/completed notification",
      );
  });
});

test("threads start and resume with approvals and sandbox off", () => {
  const permissionsOff = {
    approvalPolicy: "never",
    sandbox: "danger-full-access",
  };
  expect(threadStartParams("/repo")).toMatchObject(permissionsOff);
  expect(threadResumeParams({ cwd: "/repo", threadId: "t" })).toMatchObject(
    permissionsOff,
  );
});

test("turnStartParams sends images before the text, and no empty text", () => {
  const message = {
    text: "What colour?",
    images: [{ mediaType: ImageMediaType.Png, data: new Uint8Array() }],
  };
  expect(
    turnStartParams({ threadId: thread, message, imagePaths: ["/tmp/0.png"] })
      .input,
  ).toEqual([
    { type: "localImage", path: "/tmp/0.png" },
    { type: "text", text: "What colour?", text_elements: [] },
  ]);
  expect(
    turnStartParams({
      threadId: thread,
      message: { ...message, text: "" },
      imagePaths: ["/tmp/0.png"],
    }).input,
  ).toEqual([{ type: "localImage", path: "/tmp/0.png" }]);
});

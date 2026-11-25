import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  type CaptureRecord,
  CaptureRecordKind,
  formatCapture,
  readCaptureLine,
} from "../../testing/capture-record";
import { CODEX_VERSION } from "../version";
import { captureDir } from "./capture";
import { redactCapture } from "./redact";

const machine = {
  repo: "/Users/jo/code/app",
  mainCheckout: "/Users/jo/code/main",
  home: "/Users/jo",
  account: "jo",
  hostname: "jos-laptop.local",
  tmpdir: "/var/folders/ab/T",
};
const out = (message: unknown): CaptureRecord => ({
  kind: CaptureRecordKind.Out,
  text: JSON.stringify(message),
});
const outTexts = (content: string) =>
  content
    .split("\n")
    .map(readCaptureLine)
    .flatMap((r) => (r.kind === CaptureRecordKind.Out ? [r.text] : []));
const delta = (text: string) =>
  out({
    method: "item/agentMessage/delta",
    params: { threadId: "t", itemId: "m", delta: text },
  });

describe("redactCapture", () => {
  test("drops the notifications holding the account's plan and usage or the machine's identity", () => {
    const content = formatCapture([
      out({ method: "account/updated", params: { planType: "pro" } }),
      out({ method: "account/rateLimits/updated", params: {} }),
      out({
        method: "remoteControl/status/changed",
        params: { serverName: "x" },
      }),
      out({ id: 1, result: {} }),
    ]);
    expect(outTexts(redactCapture(content, machine))).toEqual([
      JSON.stringify({ id: 1, result: {} }),
    ]);
  });

  test("replaces the hostname, temporary folder, paths and account name", () => {
    const content = formatCapture([
      out({
        id: 1,
        result: {
          host: "on jos-laptop.local",
          image: "/var/folders/ab/T/alliance-agent-image-x/0.png",
          cwd: "/Users/jo/code/app/src",
          main: "/Users/jo/code/main/.codex/hooks.json",
          home: "/Users/jo/Library",
          said: "hi jo, jordan",
        },
      }),
      {
        kind: CaptureRecordKind.Stderr,
        text: "warning in /Users/jo/code/app\n",
      },
    ]);
    const [result] = outTexts(redactCapture(content, machine));
    expect(JSON.parse(result ?? "")).toEqual({
      id: 1,
      result: {
        host: "on host",
        image: "/tmp/alliance-agent-image-x/0.png",
        cwd: "/repo/src",
        main: "/repo/.codex/hooks.json",
        home: "/home/user/Library",
        said: "hi user, jordan",
      },
    });
    expect(redactCapture(content, machine)).toContain("warning in /repo");
  });

  test("redacts a path streamed across deltas", () => {
    const content = formatCapture([
      delta("See /Users/"),
      delta("jo/code/app/a.txt"),
    ]);
    const deltas = outTexts(redactCapture(content, machine)).map(
      (text) => JSON.parse(text).params.delta,
    );
    expect(deltas.join("")).toBe("See /repo/a.txt");
  });

  test("throws when redaction would change what the adapter reads", () => {
    const content = formatCapture([
      out({
        method: "turn/completed",
        params: {
          threadId: "t",
          turn: { id: "u", status: "completed", error: null },
        },
      }),
    ]);
    expect(() =>
      redactCapture(content, { ...machine, account: "completed" }),
    ).toThrow("changed what the adapter reads");
  });

  test("leaves the committed captures as they are", () => {
    const dir = captureDir(CODEX_VERSION);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
      const content = readFileSync(path.join(dir, file), "utf8");
      expect(redactCapture(content, machine)).toBe(content);
    }
  });
});

import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../../../shared/agent-event";
import type { AgentSession } from "../session";
import {
  type CaptureRecord,
  CaptureRecordKind,
} from "../testing/capture-record";
import { kinds, text, turn } from "../testing/turn";
import { createCodexBackend } from "./backend";
import { codexConfigArgs } from "./process";
import { RpcConnection } from "./rpc";
import { captured, gitCheckout } from "./testing/capture";
import { redPixel, watchSentImages } from "./testing/sent-images";
import {
  stubCli as cli,
  replay,
  stopReplay,
  writeCapture,
} from "./testing/stub";
import { CODEX_VERSION } from "./version";

const scratch = gitCheckout(
  mkdtempSync(path.join(tmpdir(), "codex-scripted-test-")),
);

afterEach(stopReplay);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const appServerArgs = [...codexConfigArgs, "app-server", "--strict-config"];
const inbound = (method: string, params?: object): CaptureRecord => ({
  kind: CaptureRecordKind.In,
  text: JSON.stringify({ method, params }),
});
const out = (message: unknown): CaptureRecord => ({
  kind: CaptureRecordKind.Out,
  text: JSON.stringify(message),
});
const threadId = "thread-1";
const opening: CaptureRecord[] = [
  { kind: CaptureRecordKind.Start, args: appServerArgs },
  inbound("initialize"),
  out({ id: 1, result: {} }),
  inbound("initialized"),
  inbound("config/batchWrite"),
  out({ id: 2, result: {} }),
  inbound("config/read"),
  out({ id: 3, result: { layers: [] } }),
  inbound("hooks/list"),
  out({ id: 4, result: { data: [{ hooks: [], warnings: [], errors: [] }] } }),
  inbound("thread/start"),
  out({ id: 5, result: { thread: { id: threadId } } }),
];
const resumeOpening: CaptureRecord[] = [
  ...opening.slice(0, 10),
  inbound("thread/resume", { threadId }),
  out({ id: 5, result: { thread: { id: threadId } } }),
];
const turnNotice = (status: string, error: string | null = null) =>
  out({
    method: "turn/completed",
    params: {
      threadId,
      turn: { id: "turn-1", status, error: error && { message: error } },
    },
  });
const turnStarted = out({
  method: "turn/started",
  params: {
    threadId,
    turn: { id: "turn-1", status: "inProgress", error: null },
  },
});
const delta = out({
  method: "item/agentMessage/delta",
  params: { threadId, itemId: "m", delta: "1" },
});
const ending: CaptureRecord[] = [
  { kind: CaptureRecordKind.StdinClosed },
  { kind: CaptureRecordKind.Exit, code: 0 },
];

async function startScripted(records: CaptureRecord[]): Promise<AgentSession> {
  replay(captured("version"), writeCapture([...opening, ...records]));
  return R.unwrap(await createCodexBackend(cli).start({ cwd: scratch }));
}

describe("a scripted session", () => {
  test("takes its id from thread/start", async () => {
    const session = await startScripted(ending);
    expect(session.id).toBe(threadId);
    await session.close();
  });

  test("a turn that fails before turn/start answers reports turn/completed's error once, and its message counts as read", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      turnStarted,
      out({
        method: "error",
        params: { error: { message: "boom" }, willRetry: false, threadId },
      }),
      turnNotice("failed", "boom"),
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      ...ending,
    ]);
    expect(await turn({ session, message: text("Hello") })).toEqual([
      { kind: AgentEventKind.Error, message: "boom", needsResume: false },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
    expect(await session.firstMessageRead).toBe(true);
  });

  test("a turn/start Codex refuses ends the turn with its error", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      out({ id: 6, error: { code: -32600, message: "no such thread" } }),
      ...ending,
    ]);
    expect(await turn({ session, message: text("Hello") })).toEqual([
      {
        kind: AgentEventKind.Error,
        message: "no such thread",
        needsResume: false,
      },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
  });

  test("an interrupt before turn/start goes out skips it, and one before it answers is sent once it does", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      delta,
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      inbound("turn/interrupt", { threadId, turnId: "turn-1" }),
      out({ id: 7, result: {} }),
      turnNotice("interrupted"),
      ...ending,
    ]);
    const ended: AgentEvent = {
      kind: AgentEventKind.TurnEnded,
      interrupted: true,
    };
    const skipped = turn({ session, message: text("Hello") });
    session.interrupt();
    expect(await skipped).toEqual([ended]);
    const sent = await turn({
      session,
      message: text("Hello"),
      onEvent: () => session.interrupt(),
    });
    expect(sent.at(-1)).toEqual(ended);
    await session.close();
  });

  test("an interrupt sends turn/interrupt once when turn/started gives the turn id before turn/start answers", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      turnStarted,
      delta,
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      inbound("turn/interrupt", { threadId, turnId: "turn-1" }),
      out({ id: 7, result: {} }),
      turnNotice("interrupted"),
      inbound("turn/start", { threadId }),
      out({ id: 8, result: { turn: { id: "turn-2" } } }),
      turnNotice("completed"),
      ...ending,
    ]);
    const interrupted = await turn({
      session,
      message: text("Count"),
      onEvent: () => session.interrupt(),
    });
    expect(interrupted.at(-1)).toEqual({
      kind: AgentEventKind.TurnEnded,
      interrupted: true,
    });
    expect(await turn({ session, message: text("Again") })).toEqual([
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
  });

  test("a turn Codex interrupts on its own reports an Error, and one the user interrupted that Codex completes ends uninterrupted", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      turnNotice("interrupted"),
      inbound("turn/start", { threadId }),
      delta,
      out({ id: 7, result: { turn: { id: "turn-2" } } }),
      inbound("turn/interrupt", { threadId, turnId: "turn-2" }),
      out({ id: 8, result: {} }),
      turnNotice("completed"),
      ...ending,
    ]);
    expect(await turn({ session, message: text("Hello") })).toEqual([
      {
        kind: AgentEventKind.Error,
        message: "Codex ended the turn as interrupted.",
        needsResume: false,
      },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    const completed = await turn({
      session,
      message: text("Again"),
      onEvent: () => session.interrupt(),
    });
    expect(completed.slice(1)).toEqual([
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
  });

  test("a CLI that exits mid-turn reports it as needing a resume, and later sends say so", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      { kind: CaptureRecordKind.Stderr, text: "panic\n" },
      { kind: CaptureRecordKind.Exit, code: 101 },
    ]);
    expect(await turn({ session, message: text("Hello") })).toEqual([
      {
        kind: AgentEventKind.Error,
        message: "Codex exited (code 101).\npanic",
        needsResume: true,
      },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    expect(await turn({ session, message: text("Again") })).toEqual([
      {
        kind: AgentEventKind.Error,
        message:
          "Codex exited (code 101).\npanic\nResume the session to continue.",
        needsResume: true,
      },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
  });

  test("a CLI that exits mid-turn leaves no image file behind", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      { kind: CaptureRecordKind.Exit, code: 101 },
    ]);
    const images = watchSentImages();
    await turn({ session, message: redPixel });
    expect(await images.afterTurn()).toEqual({
      existedWhenSent: [true],
      remaining: [],
    });
  });

  test("an image it can't save ends the turn with an Error before turn/start", async () => {
    const session = await startScripted(ending);
    const saved = process.env.TMPDIR;
    process.env.TMPDIR = path.join(scratch, "missing");
    try {
      expect(await turn({ session, message: redPixel })).toEqual([
        {
          kind: AgentEventKind.Error,
          message: expect.stringContaining(
            "Alliance agent couldn't save an image for Codex: ENOENT",
          ),
          needsResume: false,
        },
        { kind: AgentEventKind.TurnEnded, interrupted: false },
      ]);
    } finally {
      if (saved === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = saved;
    }
    await session.close();
  });

  test("a request from Codex is refused and reported, and the turn goes on", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => undefined);
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      out({ id: "ask-1", method: "item/tool/requestUserInput", params: {} }),
      { kind: CaptureRecordKind.In, text: JSON.stringify({ id: "ask-1" }) },
      turnNotice("completed"),
      ...ending,
    ]);
    const events = await turn({ session, message: text("Hello") });
    logged.mockRestore();
    expect(events).toEqual([
      {
        kind: AgentEventKind.Error,
        message:
          "Codex asked for item/tool/requestUserInput, which Alliance agent doesn't support.",
        needsResume: false,
      },
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
  });

  test("output the adapter can't read is reported and the turn goes on, unless it is the turn's end, which ends the turn", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => undefined);
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      { kind: CaptureRecordKind.Out, text: "nonsense" },
      out({ method: "item/agentMessage/delta", params: { threadId } }),
      turnNotice("weird"),
      inbound("turn/start", { threadId }),
      out({ id: 7, result: { turn: { id: "turn-2" } } }),
      turnNotice("completed"),
      ...ending,
    ]);
    const first = await turn({ session, message: text("Hello") });
    const second = await turn({ session, message: text("Again") });
    logged.mockRestore();
    expect(kinds(first)).toEqual([
      AgentEventKind.Error,
      AgentEventKind.Error,
      AgentEventKind.Error,
      AgentEventKind.TurnEnded,
    ]);
    expect(second).toEqual([
      { kind: AgentEventKind.TurnEnded, interrupted: false },
    ]);
    await session.close();
  });

  test("close mid-turn ends stdin, and the turn ends as interrupted with no Error", async () => {
    const session = await startScripted([
      inbound("turn/start", { threadId }),
      out({ id: 6, result: { turn: { id: "turn-1" } } }),
      ...ending,
    ]);
    const events = turn({ session, message: text("Hello") });
    await Bun.sleep(50);
    await session.close();
    expect(await events).toEqual([
      { kind: AgentEventKind.TurnEnded, interrupted: true },
    ]);
  });

  test("a resume of a live session returns it, and one after close starts again", async () => {
    replay(captured("version"), writeCapture([...resumeOpening, ...ending]));
    const backend = createCodexBackend(cli);
    const [first, second] = await Promise.all([
      backend.resume({ cwd: scratch, sessionId: threadId }),
      backend.resume({ cwd: scratch, sessionId: threadId }),
    ]);
    expect(R.unwrap(first)).toBe(R.unwrap(second));
    const closed = R.unwrap(first).close();
    const again = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId: threadId }),
    );
    await closed;
    expect(again).not.toBe(R.unwrap(first));
    await again.close();
  });

  test("overlapping starts set up one app-server at a time, since they share one CODEX_HOME", async () => {
    replay(captured("version"), writeCapture([...opening, ...ending]));
    const steps: string[] = [];
    const request = RpcConnection.prototype.request;
    const spy = spyOn(RpcConnection.prototype, "request").mockImplementation(
      async function (this: RpcConnection, method, params) {
        steps.push(`${method} sent`);
        const result = await request.call(this, method, params);
        steps.push(`${method} answered`);
        return result;
      },
    );
    const backend = createCodexBackend(cli);
    const sessions = await Promise.all([
      backend.start({ cwd: scratch }),
      backend.start({ cwd: scratch }),
    ]);
    spy.mockRestore();
    const second = steps.indexOf("initialize sent", 1);
    expect(steps.slice(0, second)).toContain("thread/start answered");
    expect(steps.slice(second)).toEqual(steps.slice(0, second));
    await Promise.all(sessions.map((session) => R.unwrap(session).close()));
  });

  test("a setup that never gets an answer fails before its app-server has exited, as does the launch queued behind it", async () => {
    const hung = path.join(scratch, "hung-codex");
    const log = path.join(scratch, "hung-codex.log");
    writeFileSync(
      hung,
      [
        "#!/bin/sh",
        `[ "$1" = --version ] && { echo "codex-cli ${CODEX_VERSION}"; exit; }`,
        `echo started >> '${log}'`,
        `trap 'kill $!; echo exited >> "${log}"; exit 0' TERM`,
        "sleep 10 & wait",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const backend = createCodexBackend(
      { ...cli, executable: hung },
      { killAfterMs: 1_000, setupTimeoutMs: 100 },
    );
    const failed = R.failure(
      new Error(
        `couldn't start ${hung} in ${scratch}: Codex didn't finish setting up within 0.1 seconds.`,
      ),
    );
    expect(
      await Promise.all([
        backend.start({ cwd: scratch }),
        backend.start({ cwd: scratch }),
      ]),
    ).toEqual([failed, failed]);
    expect(readFileSync(log, "utf8")).toBe("started\nstarted\n");
    while (readFileSync(log, "utf8") !== "started\nstarted\nexited\nexited\n")
      await Bun.sleep(50);
  });

  test("a CLI that exits during setup fails the launch at once with its stderr", async () => {
    const exiting = path.join(scratch, "exiting-codex");
    writeFileSync(
      exiting,
      [
        "#!/bin/sh",
        `[ "$1" = --version ] && { echo "codex-cli ${CODEX_VERSION}"; exit; }`,
        "echo 'unknown key foo' >&2",
        "exit 2",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const backend = createCodexBackend(
      { ...cli, executable: exiting },
      { killAfterMs: 1_000, setupTimeoutMs: 10_000 },
    );
    expect(await backend.start({ cwd: scratch })).toEqual(
      R.failure(
        new Error(
          `couldn't start ${exiting} in ${scratch}: Codex exited (code 2).\nunknown key foo`,
        ),
      ),
    );
  });

  test("a started session is live for resume until it closes", async () => {
    replay(captured("version"), writeCapture([...opening, ...ending]));
    const backend = createCodexBackend(cli);
    const started = R.unwrap(await backend.start({ cwd: scratch }));
    expect(
      R.unwrap(await backend.resume({ cwd: scratch, sessionId: threadId })),
    ).toBe(started);
    await started.close();
    replay(captured("version"), writeCapture([...resumeOpening, ...ending]));
    const again = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId: threadId }),
    );
    expect(again).not.toBe(started);
    await again.close();
  });
});

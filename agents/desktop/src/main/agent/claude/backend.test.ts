import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../../../shared/agent-event";
import { type AgentSession } from "../session";
import { createClaudeBackend } from "./backend";
import { CLAUDE_CODE_VERSION, claudeSessionArgs } from "./protocol";
import { CaptureRecordKind, captureDir } from "./testing/capture";
import {
  stubCli as cli,
  replay,
  stopReplay,
  writeCapture,
} from "./testing/stub";
import { onFifthDelta, text, turn } from "./testing/turn";

const captured = (name: string) =>
  path.join(captureDir(CLAUDE_CODE_VERSION), `${name}.jsonl`);
const scratch = mkdtempSync(path.join(tmpdir(), "claude-backend-test-"));

function stubCaptures(...files: string[]): void {
  replay(captured("version"), ...files);
}

afterEach(stopReplay);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const kinds = (events: AgentEvent[]) => events.map((event) => event.kind);

async function startEditSession(): Promise<AgentSession> {
  stubCaptures(captured("edit-and-interrupt-session"));
  return R.unwrap(await createClaudeBackend(cli).start({ cwd: scratch }));
}

describe("a captured session", () => {
  test("streams text and tool calls, then ends the turn", async () => {
    const session = await startEditSession();
    const events = await turn({ session, message: text("Edit the file") });
    expect(kinds(events)).toContain(AgentEventKind.ToolStarted);
    expect(kinds(events)).toContain(AgentEventKind.ToolFinished);
    expect(kinds(events)).not.toContain(AgentEventKind.Error);
    expect(kinds(events).at(-1)).toBe(AgentEventKind.TurnEnded);
    const deltas = events.flatMap((e) =>
      e.kind === AgentEventKind.AssistantTextDelta ? [e.text] : [],
    );
    expect(events.at(-2)).toEqual({
      kind: AgentEventKind.AssistantText,
      text: deltas.join(""),
    });
    await session.close();
  });

  test("an interrupt ends the turn with no Error, a second one sends nothing, and the next turn runs", async () => {
    const session = await startEditSession();
    await turn({ session, message: text("Edit the file") });
    const interrupted = await turn({
      session,
      message: text("Count"),
      onEvent: onFifthDelta(() => {
        session.interrupt();
        session.interrupt();
      }),
    });
    expect(kinds(interrupted)).not.toContain(AgentEventKind.Error);
    expect(interrupted.at(-1)).toEqual({
      kind: AgentEventKind.TurnEnded,
      interrupted: true,
    });
    const pong = await turn({ session, message: text("pong") });
    expect(pong).toContainEqual({
      kind: AgentEventKind.AssistantText,
      text: "pong",
    });
    await session.close();
  });

  test("keeps one turn at a time and returns the first close's promise", async () => {
    const session = await startEditSession();
    session.interrupt();
    let midTurn: { running: boolean; sent: boolean } | undefined;
    await turn({
      session,
      message: text("Edit the file"),
      onEvent: () => {
        midTurn ??= {
          running: session.turnRunning,
          sent: session.send(text("Again")).ok,
        };
      },
    });
    expect(midTurn).toEqual({ running: true, sent: false });
    expect(session.turnRunning).toBe(false);
    expect(session.close()).toBe(session.close());
    await session.close();
  });

  test("close mid-turn ends the turn with no Error", async () => {
    const session = await startEditSession();
    await turn({ session, message: text("Edit the file") });
    let closing: Promise<void> = Promise.resolve();
    const events = await turn({
      session,
      message: text("Count"),
      onEvent: onFifthDelta(() => (closing = session.close())),
    });
    await closing;
    expect(kinds(events)).not.toContain(AgentEventKind.Error);
    expect(kinds(events).at(-1)).toBe(AgentEventKind.TurnEnded);
    expect(kinds(await turn({ session, message: text("Hello") }))).toEqual([
      AgentEventKind.Error,
      AgentEventKind.TurnEnded,
    ]);
  });
});

describe("resume", () => {
  test("starts the CLI on a saved session after a restart", async () => {
    stubCaptures(captured("resume-with-image-session"));
    const session = R.unwrap(
      await createClaudeBackend(cli).resume({
        cwd: scratch,
        sessionId: randomUUID(),
      }),
    );
    expect(
      await turn({ session, message: text("Which word?") }),
    ).toContainEqual({
      kind: AgentEventKind.AssistantText,
      text: "pong",
    });
    await session.close();
  });

  test("returns the live session, also to concurrent calls, until it closes", async () => {
    stubCaptures(captured("resume-with-image-session"));
    const backend = createClaudeBackend(cli);
    const sessionId = randomUUID();
    const [a, b] = await Promise.all([
      backend.resume({ cwd: scratch, sessionId }),
      backend.resume({ cwd: scratch, sessionId }),
    ]);
    const session = R.unwrap(a);
    expect(R.unwrap(b)).toBe(session);
    expect(R.unwrap(await backend.resume({ cwd: scratch, sessionId }))).toBe(
      session,
    );
    await session.close();
    const restarted = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId }),
    );
    expect(restarted).not.toBe(session);
    await restarted.close();
  });

  test("right after close waits for the CLI to exit, then starts it again", async () => {
    stubCaptures(captured("resume-with-image-session"));
    const backend = createClaudeBackend(cli);
    const sessionId = randomUUID();
    const session = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    let closed = false;
    void session.close().then(() => (closed = true));
    const restarted = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId }),
    );
    expect(closed).toBe(true);
    expect(restarted).not.toBe(session);
    expect(
      await turn({ session: restarted, message: text("Which word?") }),
    ).toContainEqual({
      kind: AgentEventKind.AssistantText,
      text: "pong",
    });
    await restarted.close();
  });

  test("of a session the CLI doesn't have reports the CLI's error on the next send", async () => {
    const sessionId = randomUUID();
    const notFound = `No conversation found with session ID: ${sessionId}`;
    stubCaptures(
      writeCapture([
        {
          kind: CaptureRecordKind.Start,
          args: [...claudeSessionArgs, "--resume", sessionId],
        },
        { kind: CaptureRecordKind.Stderr, text: `${notFound}\n` },
        {
          kind: CaptureRecordKind.Out,
          text: JSON.stringify({
            type: "result",
            subtype: "error_during_execution",
            is_error: true,
            errors: [notFound],
          }),
        },
        { kind: CaptureRecordKind.Exit, code: 1 },
      ]),
    );
    const session = R.unwrap(
      await createClaudeBackend(cli).resume({ cwd: scratch, sessionId }),
    );
    // The CLI may exit before or after the send, which changes the message, not that it names the missing session.
    const events = await turn({ session, message: text("Hello") });
    expect(kinds(events)).toEqual([
      AgentEventKind.Error,
      AgentEventKind.TurnEnded,
    ]);
    expect(events[0]).toMatchObject({
      message: expect.stringContaining(notFound),
    });
  });

  test("after the CLI exits on its own starts it again", async () => {
    const sessionId = randomUUID();
    stubCaptures(
      writeCapture([
        {
          kind: CaptureRecordKind.Start,
          args: [...claudeSessionArgs, "--resume", sessionId],
        },
        { kind: CaptureRecordKind.Exit, code: 1 },
      ]),
    );
    const backend = createClaudeBackend(cli);
    const session = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    expect(kinds(await turn({ session, message: text("Hello") }))).toEqual([
      AgentEventKind.Error,
      AgentEventKind.TurnEnded,
    ]);
    const restarted = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId }),
    );
    expect(restarted).not.toBe(session);
    await restarted.close();
  });

  test("waits for the live session's close, not a stale handle's", async () => {
    const sessionId = randomUUID();
    stubCaptures(
      writeCapture([
        {
          kind: CaptureRecordKind.Start,
          args: [...claudeSessionArgs, "--resume", sessionId],
        },
        { kind: CaptureRecordKind.Exit, code: 1 },
      ]),
    );
    const backend = createClaudeBackend(cli);
    const stale = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    await turn({ session: stale, message: text("Hello") });
    stubCaptures(captured("resume-with-image-session"));
    const live = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    let closed = false;
    void live.close().then(() => (closed = true));
    await stale.close();
    const restarted = R.unwrap(
      await backend.resume({ cwd: scratch, sessionId }),
    );
    expect(closed).toBe(true);
    await restarted.close();
  });

  test("after a failed launch tries again", async () => {
    stubCaptures(captured("resume-with-image-session"));
    const backend = createClaudeBackend(cli);
    const sessionId = randomUUID();
    const failed = await backend.resume({
      cwd: path.join(scratch, "missing"),
      sessionId,
    });
    expect(failed.ok).toBe(false);
    const session = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    await session.close();
  });

  test("after a launch that throws tries again", async () => {
    stubCaptures(captured("resume-with-image-session"));
    const backend = createClaudeBackend(cli);
    const sessionId = randomUUID();
    const failed = await backend.resume({ cwd: "bad\0dir", sessionId });
    expect(R.isFailure(failed) && failed.error.message).toContain("null bytes");
    const session = R.unwrap(await backend.resume({ cwd: scratch, sessionId }));
    await session.close();
  });

  test("refuses an id that isn't a UUID", async () => {
    const result = await createClaudeBackend(cli).resume({
      cwd: scratch,
      sessionId: "--help",
    });
    expect(result).toEqual(
      R.failure(new Error("--help is not a Claude Code session id")),
    );
  });
});

test("a CLI that exits mid-turn reports its stderr, then ends the turn, and a send that close follows at once still reports it", async () => {
  stubCaptures(
    writeCapture([
      {
        kind: CaptureRecordKind.Start,
        args: [...claudeSessionArgs, "--session-id", randomUUID()],
      },
      { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
      { kind: CaptureRecordKind.Stderr, text: "out of memory\n" },
      { kind: CaptureRecordKind.Exit, code: 7 },
    ]),
  );
  const session = R.unwrap(
    await createClaudeBackend(cli).start({ cwd: scratch }),
  );
  expect(await turn({ session, message: text("Hello") })).toEqual([
    {
      kind: AgentEventKind.Error,
      message: "Claude Code exited (code 7).\nout of memory",
    },
    { kind: AgentEventKind.TurnEnded, interrupted: false },
  ]);
  const next = turn({ session, message: text("Again") });
  await session.close();
  expect(await next).toContainEqual({
    kind: AgentEventKind.Error,
    message:
      "Claude Code exited (code 7).\nout of memory\nResume the session to continue.",
  });
});

describe("start", () => {
  test("refuses a Claude Code version other than the supported one", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Out, text: "9.9.9 (Claude Code)" },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    const result = await createClaudeBackend(cli).start({ cwd: scratch });
    expect(R.isFailure(result) && result.error.message).toContain(
      "is Claude Code 9.9.9",
    );
  });

  test("fails when the executable doesn't exist", async () => {
    const result = await createClaudeBackend({
      ...cli,
      executable: path.join(scratch, "no-claude"),
    }).start({ cwd: scratch });
    expect(R.isFailure(result) && result.error.message).toContain("ENOENT");
  });
});

test("output the parser can't read reports an Error and the turn goes on", async () => {
  stubCaptures(
    writeCapture([
      {
        kind: CaptureRecordKind.Start,
        args: [...claudeSessionArgs, "--session-id", randomUUID()],
      },
      { kind: CaptureRecordKind.In, text: '{"type":"user"}' },
      { kind: CaptureRecordKind.Out, text: "not json" },
      {
        kind: CaptureRecordKind.Out,
        text: JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
        }),
      },
      { kind: CaptureRecordKind.StdinClosed },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  const logged = spyOn(console, "error").mockImplementation(() => undefined);
  const session = R.unwrap(
    await createClaudeBackend(cli).start({ cwd: scratch }),
  );
  const events = await turn({ session, message: text("Hello") });
  logged.mockRestore();
  expect(kinds(events)).toEqual([
    AgentEventKind.Error,
    AgentEventKind.TurnEnded,
  ]);
  expect(events[0]).toMatchObject({
    message: expect.stringContaining("can't read"),
  });
  await session.close();
});

test("output between turns reaches no listener", async () => {
  stubCaptures(
    writeCapture([
      {
        kind: CaptureRecordKind.Start,
        args: [...claudeSessionArgs, "--session-id", randomUUID()],
      },
      {
        kind: CaptureRecordKind.Out,
        text: JSON.stringify({
          type: "assistant",
          parent_tool_use_id: null,
          message: { content: [{ type: "text", text: "stray" }] },
        }),
      },
      {
        kind: CaptureRecordKind.Out,
        text: JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
        }),
      },
      { kind: CaptureRecordKind.StdinClosed },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  const session = R.unwrap(
    await createClaudeBackend(cli).start({ cwd: scratch }),
  );
  const events: AgentEvent[] = [];
  session.subscribe((event) => events.push(event));
  await session.close();
  expect(events).toEqual([]);
});

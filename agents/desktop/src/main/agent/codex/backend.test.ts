import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../../../shared/agent-event";
import type { AgentSession } from "../session";
import { kinds, onFifthDelta, text, turn } from "../testing/turn";
import { createCodexBackend } from "./backend";
import { captured, capturedCheckout, gitCheckout } from "./testing/capture";
import { redPixel, watchSentImages } from "./testing/sent-images";
import { stubCli as cli, replay, stopReplay } from "./testing/stub";

const scratch = gitCheckout(mkdtempSync(path.join(tmpdir(), "codex-test-")));
const repo = capturedCheckout(scratch);

afterEach(stopReplay);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const texts = (events: AgentEvent[]) =>
  events.flatMap((e) =>
    e.kind === AgentEventKind.AssistantText ? [e.text] : [],
  );

async function startEditSession(): Promise<AgentSession> {
  replay(captured("version"), captured("edit-and-interrupt-session"));
  return R.unwrap(await createCodexBackend(cli).start({ cwd: repo }));
}

describe("a captured session", () => {
  test("streams text and a tool call, then ends the turn", async () => {
    const session = await startEditSession();
    const events = await turn({ session, message: text("Edit the file") });
    expect(kinds(events)).toContain(AgentEventKind.AssistantTextDelta);
    expect(kinds(events)).toContain(AgentEventKind.ToolStarted);
    expect(kinds(events)).toContain(AgentEventKind.ToolFinished);
    expect(kinds(events)).not.toContain(AgentEventKind.Error);
    expect(events.at(-1)).toEqual({
      kind: AgentEventKind.TurnEnded,
      interrupted: false,
    });
    const started = events.find((e) => e.kind === AgentEventKind.ToolStarted);
    expect(started).toMatchObject({ name: "command" });
    await session.close();
  });

  test("an interrupt ends the turn with no Error, and the next turn runs", async () => {
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
    expect(texts(pong)).toEqual(["pong"]);
    await session.close();
  });

  test("keeps one turn at a time, since Codex would add a second message to the running turn", async () => {
    const session = await startEditSession();
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
    expect(session.close()).toBe(session.close());
    await session.close();
  });

  test("a resumed session takes an image and remembers the thread", async () => {
    replay(captured("version"), captured("resume-with-image-session"));
    const session = R.unwrap(
      await createCodexBackend(cli).resume({
        cwd: repo,
        sessionId: "01a1f059-900f-7110-ac11-064988711f2e",
      }),
    );
    expect(
      texts(await turn({ session, message: text("Which word?") })),
    ).toEqual(["pong"]);
    const images = watchSentImages();
    const image = await turn({ session, message: redPixel });
    expect(texts(image).join("")).toMatch(/red/i);
    expect(await images.afterTurn()).toEqual({
      existedWhenSent: [true],
      remaining: [],
    });
    await session.close();
  });

  test("resuming a thread Codex doesn't have fails, naming why", async () => {
    replay(captured("version"), captured("missing-thread-session"));
    const resumed = await createCodexBackend(cli).resume({
      cwd: repo,
      sessionId: "019a0000-0000-7000-8000-000000000000",
    });
    expect(resumed.ok).toBe(false);
    if (!resumed.ok)
      expect(resumed.error.message).toContain("no rollout found");
  });
});

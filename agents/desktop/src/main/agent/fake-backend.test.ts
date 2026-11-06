import { describe, expect, spyOn, test } from "bun:test";
import { R } from "../result";
import { createFakeBackend, demoScript } from "./fake-backend";
import {
  type AgentEvent,
  AgentEventKind,
  type AgentMessage,
  type AgentSession,
  ImageMediaType,
} from "./session";

const text = (value: string): AgentMessage => ({ text: value, images: [] });

function untilTurnEnded(session: AgentSession): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  return new Promise((resolve) => {
    const unsubscribe = session.subscribe((event) => {
      events.push(event);
      if (event.kind !== AgentEventKind.TurnEnded) return;
      unsubscribe();
      resolve(events);
    });
  });
}

function nextTurn(
  session: AgentSession,
  message: AgentMessage,
): Promise<AgentEvent[]> {
  const ended = untilTurnEnded(session);
  session.send(message);
  return ended;
}

const lookAroundKinds = [
  AgentEventKind.AssistantText,
  AgentEventKind.ToolStarted,
  AgentEventKind.ToolFinished,
  AgentEventKind.ToolStarted,
  AgentEventKind.ToolFinished,
  AgentEventKind.AssistantText,
  AgentEventKind.TurnEnded,
];

async function startDemo(stepDelayMs = 0) {
  const backend = createFakeBackend({ script: demoScript, stepDelayMs });
  const session = R.unwrap(await backend.start({ cwd: "/repo" }));
  return { backend, session };
}

describe("the fake backend's demo session", () => {
  test("emits every event kind across its turns", async () => {
    const { session } = await startDemo();
    const first = await nextTurn(session, text("Look around"));
    const second = await nextTurn(session, {
      text: "What's in this screenshot?",
      images: [{ mediaType: ImageMediaType.Png, data: new Uint8Array([1]) }],
    });
    const third = await nextTurn(session, text("Run the tests"));

    expect(first.map((event) => event.kind)).toEqual(lookAroundKinds);
    expect(second).toEqual([
      {
        kind: AgentEventKind.AssistantText,
        text: "I can see your image (image/png).",
      },
      { kind: AgentEventKind.TurnEnded },
    ]);
    expect(third.map((event) => event.kind)).toEqual([
      AgentEventKind.AssistantText,
      AgentEventKind.Error,
      AgentEventKind.TurnEnded,
    ]);
    expect(new Set([...first, ...second, ...third].map((e) => e.kind))).toEqual(
      new Set(Object.values(AgentEventKind)),
    );
  });

  test("replies to a message without an image by asking for one", async () => {
    const { session } = await startDemo();
    await nextTurn(session, text("Look around"));
    const [reply] = await nextTurn(session, text("Here's my screenshot"));
    expect(reply).toEqual({
      kind: AgentEventKind.AssistantText,
      text: "I don't see an image. Paste or drop a screenshot and send it again.",
    });
  });

  test("ends with an error once the script runs out", async () => {
    const backend = createFakeBackend({ script: [], stepDelayMs: 0 });
    const session = R.unwrap(await backend.start({ cwd: "/repo" }));
    expect(await nextTurn(session, text("Hello"))).toEqual([
      {
        kind: AgentEventKind.Error,
        message: "The fake session's script has no more turns.",
      },
      { kind: AgentEventKind.TurnEnded },
    ]);
  });
});

describe("interrupt", () => {
  test("ends the turn and drops its remaining events", async () => {
    const { session } = await startDemo(5);
    const firstText = new Promise<void>((resolve) =>
      session.subscribe(() => resolve()),
    );
    const ended = nextTurn(session, text("Look around"));
    await firstText;
    session.interrupt();

    expect((await ended).map((event) => event.kind)).toEqual([
      AgentEventKind.AssistantText,
      AgentEventKind.TurnEnded,
    ]);
  });

  test("accepts the next message once TurnEnded arrives", async () => {
    const { session } = await startDemo(5);
    const turnEnded = new Promise<void>((resolve) =>
      session.subscribe((event) => {
        if (event.kind === AgentEventKind.TurnEnded) resolve();
      }),
    );
    session.send(text("Look around"));
    session.interrupt();
    expect(() => session.send(text("Never mind"))).toThrow(
      `session ${session.id} is mid-turn`,
    );
    await turnEnded;
    expect(await nextTurn(session, text("Never mind"))).toEqual([
      {
        kind: AgentEventKind.AssistantText,
        text: "I don't see an image. Paste or drop a screenshot and send it again.",
      },
      { kind: AgentEventKind.TurnEnded },
    ]);
  });

  test("during the last step delay ends the turn once", async () => {
    const { session } = await startDemo(5);
    const kinds: AgentEventKind[] = [];
    const lastText = new Promise<void>((resolve) =>
      session.subscribe((event) => {
        kinds.push(event.kind);
        if (kinds.length === 6) resolve();
      }),
    );
    const ended = nextTurn(session, text("Look around"));
    await lastText;
    session.interrupt();
    await ended;
    await nextTurn(session, text("Never mind"));
    expect(kinds.slice(6)).toEqual([
      AgentEventKind.TurnEnded,
      AgentEventKind.AssistantText,
      AgentEventKind.TurnEnded,
    ]);
  });

  test("does nothing between turns", async () => {
    const { session } = await startDemo();
    session.interrupt();
    expect(
      (await nextTurn(session, text("Look around"))).map((event) => event.kind),
    ).toEqual(lookAroundKinds);
  });
});

test("send throws while a turn is running", async () => {
  const { session } = await startDemo(5);
  session.send(text("Look around"));
  expect(() => session.send(text("And another thing"))).toThrow(
    `session ${session.id} is mid-turn`,
  );
  session.interrupt();
});

test("a listener can send the next message on TurnEnded", async () => {
  const { session } = await startDemo();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  let sent = false;
  const secondTurnEnded = new Promise<void>((resolve) =>
    session.subscribe((event) => {
      if (event.kind !== AgentEventKind.TurnEnded) return;
      if (sent) return resolve();
      sent = true;
      session.send(text("Here's my screenshot"));
    }),
  );
  session.send(text("Look around"));
  await secondTurnEnded;
  const calls = [...logged.mock.calls];
  logged.mockRestore();
  expect(calls).toEqual([]);
});

test("a throwing listener is reported and the turn still ends", async () => {
  const { session } = await startDemo();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  session.subscribe((event) => {
    if (event.kind === AgentEventKind.ToolStarted) throw new Error("ui bug");
  });
  const kinds = (await nextTurn(session, text("Look around"))).map(
    (event) => event.kind,
  );
  const calls = [...logged.mock.calls];
  logged.mockRestore();

  expect(calls).toContainEqual([
    `session ${session.id} listener threw on ${AgentEventKind.ToolStarted}`,
    new Error("ui bug"),
  ]);
  expect(kinds).toEqual(lookAroundKinds);
  const [reply] = await nextTurn(session, text("Here's my screenshot"));
  expect(reply?.kind).toBe(AgentEventKind.AssistantText);
});

test("a listener's interrupt ends the turn after the event in flight", async () => {
  const { session } = await startDemo();
  session.subscribe((event) => {
    if (event.kind === AgentEventKind.ToolStarted) session.interrupt();
  });
  const kinds: AgentEventKind[] = [];
  session.subscribe((event) => kinds.push(event.kind));
  await nextTurn(session, text("Look around"));
  expect(kinds).toEqual([
    AgentEventKind.AssistantText,
    AgentEventKind.ToolStarted,
    AgentEventKind.TurnEnded,
  ]);
});

test("a listener subscribed mid-dispatch waits for the next event", async () => {
  const { session } = await startDemo();
  const late: AgentEvent[] = [];
  const subscribed = new Promise<void>((resolve) =>
    session.subscribe((event) => {
      if (event.kind !== AgentEventKind.TurnEnded) return;
      session.subscribe((lateEvent) => late.push(lateEvent));
      resolve();
    }),
  );
  session.send(text("Look around"));
  await subscribed;
  expect(late).toEqual([]);
});

test("a listener unsubscribed mid-dispatch misses the event", async () => {
  const { session } = await startDemo();
  const heard: AgentEvent[] = [];
  let unsubscribeLater = () => {};
  session.subscribe(() => unsubscribeLater());
  unsubscribeLater = session.subscribe((event) => heard.push(event));
  await nextTurn(session, text("Look around"));
  expect(heard).toEqual([]);
});

test("an unsubscribed listener hears nothing more", async () => {
  const { session } = await startDemo();
  const heard: AgentEvent[] = [];
  session.subscribe((event) => heard.push(event))();
  await nextTurn(session, text("Look around"));
  expect(heard).toEqual([]);
});

describe("resume", () => {
  test("continues a session from the turn it reached", async () => {
    const { backend, session } = await startDemo();
    await nextTurn(session, text("Look around"));
    const resumed = R.unwrap(
      await backend.resume({ cwd: "/repo", sessionId: session.id }),
    );
    expect(resumed.id).toBe(session.id);
    const [reply] = await nextTurn(resumed, text("Here's my screenshot"));
    expect(reply).toMatchObject({ text: expect.stringContaining("image") });
  });

  test("fails for a session id it never started", async () => {
    const { backend } = await startDemo();
    const result = await backend.resume({ cwd: "/repo", sessionId: "nope" });
    expect(result).toEqual(R.failure(new Error("no fake session nope")));
  });
});

import { describe, expect, spyOn, test } from "bun:test";
import { R, type Result } from "../../../../../common/src/result";
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
  R.unwrap(session.send(message));
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
      AgentEventKind.AssistantTextDelta,
      AgentEventKind.AssistantTextDelta,
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

  test("names each image of a message with several", async () => {
    const { session } = await startDemo();
    await nextTurn(session, text("Look around"));
    const [reply] = await nextTurn(session, {
      text: "What's in these screenshots?",
      images: [
        { mediaType: ImageMediaType.Png, data: new Uint8Array([1]) },
        { mediaType: ImageMediaType.Jpeg, data: new Uint8Array([2]) },
      ],
    });
    expect(reply).toEqual({
      kind: AgentEventKind.AssistantText,
      text: "I can see your 2 images (image/png, image/jpeg).",
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
    R.unwrap(session.send(text("Look around")));
    session.interrupt();
    expect(session.send(text("Never mind"))).toEqual(
      R.failure(new Error(`session ${session.id} is mid-turn`)),
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
    expect(session.turnRunning).toBe(true);
    session.interrupt();
    await ended;
    await nextTurn(session, text("Never mind"));
    expect(kinds.slice(6)).toEqual([
      AgentEventKind.TurnEnded,
      AgentEventKind.AssistantText,
      AgentEventKind.TurnEnded,
    ]);
  });

  test("doesn't wait a further step delay to end the turn", async () => {
    const stepDelayMs = 300;
    const { session } = await startDemo(stepDelayMs);
    const firstText = new Promise<void>((resolve) =>
      session.subscribe(() => resolve()),
    );
    const ended = nextTurn(session, text("Look around"));
    await firstText;
    const interruptedAt = performance.now();
    session.interrupt();
    await ended;
    expect(performance.now() - interruptedAt).toBeLessThan(stepDelayMs * 1.5);
  });

  test("does nothing between turns", async () => {
    const { session } = await startDemo();
    session.interrupt();
    expect(
      (await nextTurn(session, text("Look around"))).map((event) => event.kind),
    ).toEqual(lookAroundKinds);
  });
});

test("send fails while a turn is running", async () => {
  const { session } = await startDemo(5);
  R.unwrap(session.send(text("Look around")));
  expect(session.send(text("And another thing"))).toEqual(
    R.failure(new Error(`session ${session.id} is mid-turn`)),
  );
  session.interrupt();
});

test("send emits nothing before it returns", async () => {
  const { session } = await startDemo();
  const heard: AgentEvent[] = [];
  session.subscribe((event) => heard.push(event));
  const ended = nextTurn(session, text("Look around"));
  expect(heard).toEqual([]);
  await ended;
});

test("turnRunning tells a resumed session's caller a turn is in progress", async () => {
  const { backend, session } = await startDemo();
  expect(session.turnRunning).toBe(false);
  const ended = nextTurn(session, text("Look around"));
  const resumed = R.unwrap(
    await backend.resume({ cwd: "/repo", sessionId: session.id }),
  );
  expect(resumed.turnRunning).toBe(true);
  await ended;
  expect(resumed.turnRunning).toBe(false);
});

test("a listener can send the next message on TurnEnded", async () => {
  const { session } = await startDemo();
  const sent = new Promise<Result<void, Error>>((resolve) => {
    const unsubscribe = session.subscribe((event) => {
      if (event.kind !== AgentEventKind.TurnEnded) return;
      unsubscribe();
      resolve(session.send(text("Here's my screenshot")));
    });
  });
  R.unwrap(session.send(text("Look around")));
  expect(await sent).toEqual(R.success(undefined));
  await untilTurnEnded(session);
});

test("a throwing listener doesn't stop the turn", async () => {
  const { session } = await startDemo();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  session.subscribe((event) => {
    if (event.kind === AgentEventKind.ToolStarted) throw new Error("ui bug");
  });
  const kinds = (await nextTurn(session, text("Look around"))).map(
    (event) => event.kind,
  );
  logged.mockRestore();

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

test("sessions on one backend keep their own ids and script positions", async () => {
  const { backend, session: first } = await startDemo();
  const second = R.unwrap(await backend.start({ cwd: "/repo" }));
  expect(second.id).not.toBe(first.id);

  await nextTurn(first, text("Look around"));
  const secondTurn = await nextTurn(second, text("Look around"));
  expect(secondTurn.map((event) => event.kind)).toEqual(lookAroundKinds);

  for (const session of [first, second]) {
    const { id: sessionId } = session;
    expect(R.unwrap(await backend.resume({ cwd: "/repo", sessionId }))).toBe(
      session,
    );
  }
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

describe("close", () => {
  test("ends a running turn with TurnEnded and no Error", async () => {
    const { session } = await startDemo(5);
    const order: (AgentEventKind | "closed")[] = [];
    session.subscribe((event) => order.push(event.kind));
    const ended = nextTurn(session, text("Look around"));
    await session.close();
    order.push("closed");
    expect(order).toEqual([AgentEventKind.TurnEnded, "closed"]);
    expect(await ended).toEqual([{ kind: AgentEventKind.TurnEnded }]);
    expect(session.turnRunning).toBe(false);
  });

  test("leaves the session no longer live", async () => {
    const { session } = await startDemo();
    await session.close();
    expect(await nextTurn(session, text("Hello"))).toEqual([
      {
        kind: AgentEventKind.Error,
        message: `The fake session ${session.id} is closed.`,
      },
      { kind: AgentEventKind.TurnEnded },
    ]);
  });

  test("resume while closing waits for it, then continues from the turn it reached", async () => {
    const { backend, session } = await startDemo(5);
    const order: (AgentEventKind | "resumed")[] = [];
    session.subscribe((event) => order.push(event.kind));
    const ended = nextTurn(session, text("Look around"));
    void session.close();
    const sessionId = session.id;
    const [a, b] = await Promise.all([
      backend.resume({ cwd: "/repo", sessionId }),
      backend.resume({ cwd: "/repo", sessionId }),
    ]);
    order.push("resumed");
    expect(order).toEqual([AgentEventKind.TurnEnded, "resumed"]);
    expect(await ended).toEqual([{ kind: AgentEventKind.TurnEnded }]);
    const resumed = R.unwrap(a);
    expect(R.unwrap(b)).toBe(resumed);
    expect(resumed).not.toBe(session);
    expect(resumed.id).toBe(sessionId);
    const [reply] = await nextTurn(resumed, text("Here's my screenshot"));
    expect(reply).toMatchObject({ text: expect.stringContaining("image") });
  });

  test("returns the first call's promise when called again", async () => {
    const { session } = await startDemo();
    expect(session.close()).toBe(session.close());
  });
});

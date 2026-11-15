import { expect, spyOn, test } from "bun:test";
import { type AgentEvent, AgentEventKind } from "../../shared/agent-event";
import { SessionListeners } from "./listeners";

const first: AgentEvent = { kind: AgentEventKind.AssistantText, text: "one" };
const second: AgentEvent = {
  kind: AgentEventKind.TurnEnded,
  interrupted: false,
};

function setup() {
  const listeners = new SessionListeners("session-1");
  const heard: AgentEvent[] = [];
  const record = (event: AgentEvent) => heard.push(event);
  return { listeners, heard, record };
}

test("a listener that throws is logged and the others still hear the event", () => {
  const { listeners, heard, record } = setup();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  listeners.subscribe(() => {
    throw new Error("ui bug");
  });
  listeners.subscribe(record);
  listeners.emit(first);
  const calls = [...logged.mock.calls];
  logged.mockRestore();

  expect(calls).toEqual([
    [
      `session session-1 listener threw on ${AgentEventKind.AssistantText}`,
      new Error("ui bug"),
    ],
  ]);
  expect(heard).toEqual([first]);
});

test("a listener subscribed mid-dispatch first hears the next event", () => {
  const { listeners, heard, record } = setup();
  const unsubscribe = listeners.subscribe(() => {
    unsubscribe();
    listeners.subscribe(record);
  });
  listeners.emit(first);
  expect(heard).toEqual([]);
  listeners.emit(second);
  expect(heard).toEqual([second]);
});

test("a listener unsubscribed mid-dispatch misses the event", () => {
  const { listeners, heard, record } = setup();
  let unsubscribeLater = () => {};
  listeners.subscribe(() => unsubscribeLater());
  unsubscribeLater = listeners.subscribe(record);
  listeners.emit(first);
  expect(heard).toEqual([]);
});

test("a listener re-subscribed mid-dispatch first hears the next event", () => {
  const { listeners, heard, record } = setup();
  let unsubscribeOld: (() => void) | undefined;
  listeners.subscribe(() => {
    if (!unsubscribeOld) return;
    unsubscribeOld();
    unsubscribeOld = undefined;
    listeners.subscribe(record);
  });
  unsubscribeOld = listeners.subscribe(record);
  listeners.emit(first);
  expect(heard).toEqual([]);
  listeners.emit(second);
  expect(heard).toEqual([second]);
});

test("an old unsubscribe leaves a later subscription of the listener alone", () => {
  const { listeners, heard, record } = setup();
  const unsubscribeOld = listeners.subscribe(record);
  unsubscribeOld();
  listeners.subscribe(record);
  unsubscribeOld();
  listeners.emit(first);
  expect(heard).toEqual([first]);
});

test("one listener subscribed twice is two subscriptions", () => {
  const { listeners, heard, record } = setup();
  const unsubscribeFirst = listeners.subscribe(record);
  listeners.subscribe(record);
  listeners.emit(first);
  expect(heard).toEqual([first, first]);
  unsubscribeFirst();
  listeners.emit(second);
  expect(heard).toEqual([first, first, second]);
});

test("an unsubscribed listener hears nothing more", () => {
  const { listeners, heard, record } = setup();
  listeners.subscribe(record)();
  listeners.emit(first);
  expect(heard).toEqual([]);
});

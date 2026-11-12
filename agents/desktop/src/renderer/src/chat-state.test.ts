import { describe, expect, test } from "bun:test";
import { type AgentEvent, AgentEventKind } from "../../shared/agent-event";
import {
  applyEvent,
  type Chat,
  emptyChat,
  firstMessage,
  ItemKind,
  resumedMidTurn,
  sendFailed,
  sendMessage,
  stopRequested,
  ToolStatus,
  TurnState,
  turnStatus,
} from "./chat-state";

const play = (chat: Chat, events: AgentEvent[]) =>
  events.reduce(applyEvent, chat);
const turnEnded: AgentEvent = {
  kind: AgentEventKind.TurnEnded,
  interrupted: false,
};
const turnStopped: AgentEvent = {
  kind: AgentEventKind.TurnEnded,
  interrupted: true,
};
const asked = sendMessage(emptyChat, "Hi");

describe("chat state", () => {
  test("sending adds the message and starts a turn", () => {
    expect(asked.items).toEqual([{ kind: ItemKind.User, key: 0, text: "Hi" }]);
    expect(asked.turn).toBe(TurnState.Running);
    expect(turnStatus(asked)).toBe("Claude is working…");
  });

  test("a start's first message goes ahead of events that beat its reply, which keep the turn's state", () => {
    const delta: AgentEvent = {
      kind: AgentEventKind.AssistantTextDelta,
      text: "Hel",
    };
    expect(firstMessage(undefined, "Hi")).toEqual(asked);
    const running = firstMessage(play(emptyChat, [delta]), "Hi");
    expect(running.items.map((item) => item.kind)).toEqual([
      ItemKind.User,
      ItemKind.Assistant,
    ]);
    expect(running.turn).toBe(TurnState.Running);
    const ended = firstMessage(play(emptyChat, [delta, turnEnded]), "Hi");
    expect(ended.turn).toBe(TurnState.Idle);
    expect(turnStatus(ended)).toBe("Claude finished.");
    expect(new Set(ended.items.map((item) => item.key)).size).toBe(2);
  });

  test("deltas grow one block, and the whole block replaces them", () => {
    const streaming = play(asked, [
      { kind: AgentEventKind.AssistantTextDelta, text: "Hel" },
      { kind: AgentEventKind.AssistantTextDelta, text: "lo" },
    ]);
    expect(streaming.items.at(-1)).toEqual({
      kind: ItemKind.Assistant,
      key: 1,
      text: "Hello",
      streaming: true,
    });
    const whole = applyEvent(streaming, {
      kind: AgentEventKind.AssistantText,
      text: "Hello.",
    });
    expect(whole.items).toHaveLength(2);
    expect(whole.items.at(-1)).toMatchObject({
      text: "Hello.",
      streaming: false,
    });
  });

  test("a block that arrives whole after another starts a new item", () => {
    const chat = play(asked, [
      { kind: AgentEventKind.AssistantText, text: "One" },
      { kind: AgentEventKind.AssistantText, text: "Two" },
    ]);
    expect(chat.items.map((item) => item.kind)).toEqual([
      ItemKind.User,
      ItemKind.Assistant,
      ItemKind.Assistant,
    ]);
  });

  test("a tool call finishes as done or failed, and one left open reads as unfinished", () => {
    const chat = play(asked, [
      {
        kind: AgentEventKind.ToolStarted,
        toolCallId: "a",
        name: "Read",
        input: {},
      },
      {
        kind: AgentEventKind.ToolStarted,
        toolCallId: "b",
        name: "Bash",
        input: {},
      },
      {
        kind: AgentEventKind.ToolStarted,
        toolCallId: "c",
        name: "Edit",
        input: {},
      },
      {
        kind: AgentEventKind.ToolFinished,
        toolCallId: "a",
        output: "x",
        isError: false,
      },
      {
        kind: AgentEventKind.ToolFinished,
        toolCallId: "b",
        output: "no",
        isError: true,
      },
      turnEnded,
    ]);
    expect(
      chat.items.flatMap((item) =>
        item.kind === ItemKind.Tool
          ? [[item.name, item.status, item.output]]
          : [],
      ),
    ).toEqual([
      ["Read", ToolStatus.Done, "x"],
      ["Bash", ToolStatus.Failed, "no"],
      ["Edit", ToolStatus.Unfinished, undefined],
    ]);
    expect(turnStatus(chat)).toBe("Claude finished.");
  });

  test("turn ended closes a block an interrupt left streaming", () => {
    const chat = play(stopRequested(asked), [
      { kind: AgentEventKind.AssistantTextDelta, text: "1\n2" },
      turnStopped,
    ]);
    expect(chat.items[1]).toMatchObject({ text: "1\n2", streaming: false });
  });

  test("a stopped turn says so", () => {
    const stopping = stopRequested(asked);
    expect(stopping.turn).toBe(TurnState.Stopping);
    expect(turnStatus(stopping)).toBe("Stopping…");
    const stopped = applyEvent(stopping, turnStopped);
    expect(stopped.items.at(-1)?.kind).toBe(ItemKind.Stopped);
    expect(stopped.turn).toBe(TurnState.Idle);
    expect(turnStatus(stopped)).toBe("Stopped.");
  });

  test("a stop that missed the turn's end leaves the reply finished", () => {
    const finished = applyEvent(stopRequested(asked), turnEnded);
    expect(finished.items.at(-1)?.kind).toBe(ItemKind.User);
    expect(turnStatus(finished)).toBe("Claude finished.");
  });

  test("stopping between turns changes nothing", () => {
    expect(stopRequested(emptyChat)).toBe(emptyChat);
  });

  test("an error in the turn reads as a problem", () => {
    const chat = play(asked, [
      {
        kind: AgentEventKind.Error,
        message: "API Error: 529 Overloaded",
        needsResume: false,
      },
      turnEnded,
    ]);
    expect(chat.items.at(-1)).toMatchObject({
      kind: ItemKind.Error,
      message: "API Error: 529 Overloaded",
      needsResume: false,
      refused: false,
    });
    expect(turnStatus(chat)).toBe("Claude ran into a problem.");
  });

  test("a refused send ends the turn it started with its error", () => {
    const chat = sendFailed(asked, "This conversation isn't open. Reopen it.");
    expect(chat.items.at(-1)).toMatchObject({
      needsResume: true,
      refused: true,
    });
    expect(chat.turn).toBe(TurnState.Idle);
    expect(turnStatus(chat)).toBe("Claude ran into a problem.");
  });

  test("a refused send's message leaves the transcript", () => {
    const stopped = play(stopRequested(asked), [turnStopped]);
    const chat = sendFailed(sendMessage(stopped, "Again"), "mid-turn");
    expect(chat.items.map((item) => item.kind)).toEqual([
      ItemKind.User,
      ItemKind.Stopped,
      ItemKind.Error,
    ]);
    expect(turnStatus(chat)).toBe("Claude ran into a problem.");
  });

  test("a session resumed mid-turn reads as working", () => {
    expect(resumedMidTurn(emptyChat).turn).toBe(TurnState.Running);
  });

  test("the status line is empty before the first turn", () => {
    expect(turnStatus(emptyChat)).toBe("");
  });

  test("a turn resumed midway says how it ended", () => {
    const resumed = resumedMidTurn(emptyChat);
    const reply = { kind: AgentEventKind.AssistantText, text: "Done" } as const;
    expect(turnStatus(play(resumed, [reply, turnEnded]))).toBe(
      "Claude finished.",
    );
    expect(turnStatus(play(resumed, [turnStopped]))).toBe("Stopped.");
  });

  test("only the latest turn decides the status", () => {
    const failed = play(asked, [
      { kind: AgentEventKind.Error, message: "x", needsResume: true },
      turnEnded,
    ]);
    const next = play(sendMessage(failed, "Again"), [turnEnded]);
    expect(turnStatus(next)).toBe("Claude finished.");
  });
});

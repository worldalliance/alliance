import { type AgentEvent, AgentEventKind } from "../../shared/agent-event";

export enum ItemKind {
  User = "user",
  Assistant = "assistant",
  Tool = "tool",
  Error = "error",
  Stopped = "stopped",
}

export enum ToolStatus {
  Running = "running",
  Done = "done",
  Failed = "failed",
  Unfinished = "unfinished",
}

export enum TurnState {
  Idle = "idle",
  Running = "running",
  Stopping = "stopping",
}

export type ChatItem =
  | { kind: ItemKind.User; key: number; text: string }
  | { kind: ItemKind.Assistant; key: number; text: string; streaming: boolean }
  | {
      kind: ItemKind.Tool;
      key: number;
      toolCallId: string;
      name: string;
      input: unknown;
      output: string | undefined;
      status: ToolStatus;
    }
  | {
      kind: ItemKind.Error;
      key: number;
      message: string;
      /** True when the conversation takes another message only once reopened. */
      needsResume: boolean;
      /** True when the session refused the message, so Claude never got it. */
      refused: boolean;
    }
  | { kind: ItemKind.Stopped; key: number };

export type Chat = {
  items: readonly ChatItem[];
  turn: TurnState;
  nextKey: number;
  /** The nextKey at the last reopen: errors keyed below it came before it, so reopening no longer applies to them. */
  reopenedAt: number;
};

export const emptyChat: Chat = {
  items: [],
  turn: TurnState.Idle,
  nextKey: 0,
  reopenedAt: 0,
};

function push(chat: Chat, item: (key: number) => ChatItem): Chat {
  return {
    ...chat,
    items: [...chat.items, item(chat.nextKey)],
    nextKey: chat.nextKey + 1,
  };
}

function replaceLast(chat: Chat, item: ChatItem): Chat {
  return { ...chat, items: [...chat.items.slice(0, -1), item] };
}

const streamingBlock = (chat: Chat) => {
  const last = chat.items.at(-1);
  return last?.kind === ItemKind.Assistant && last.streaming ? last : undefined;
};

export function sendMessage(chat: Chat, text: string): Chat {
  return {
    ...push(chat, (key) => ({ key, kind: ItemKind.User, text })),
    turn: TurnState.Running,
  };
}

/** A start's events can reach the renderer before its reply, so its first message goes ahead of any already applied. */
export function firstMessage(chat: Chat | undefined, text: string): Chat {
  if (!chat) return sendMessage(emptyChat, text);
  return {
    ...chat,
    items: [{ key: chat.nextKey, kind: ItemKind.User, text }, ...chat.items],
    nextKey: chat.nextKey + 1,
  };
}

/** A send the session refused never started a turn, so its message leaves the transcript, staying in the message box. The error offers a reopen: a refusal the view can meet, such as a turn the session still runs, means the view is out of step with the session, which reopening reads again. */
export function sendFailed(chat: Chat, message: string): Chat {
  const refused = chat.items.findLastIndex(
    (item) => item.kind === ItemKind.User,
  );
  const items = chat.items.filter((_, index) => index !== refused);
  return {
    ...push({ ...chat, items }, (key) => ({
      key,
      kind: ItemKind.Error,
      message,
      needsResume: true,
      refused: true,
    })),
    turn: TurnState.Idle,
  };
}

export function stopRequested(chat: Chat): Chat {
  switch (chat.turn) {
    case TurnState.Running:
      return { ...chat, turn: TurnState.Stopping };
    case TurnState.Idle:
    case TurnState.Stopping:
      return chat;
    default:
      throw new Error(`unknown turn state: ${chat.turn satisfies never}`);
  }
}

export function reopened(chat: Chat): Chat {
  return { ...chat, reopenedAt: chat.nextKey };
}

/** A resumed session can already be mid-turn, having sent events this view never heard. */
export function resumedMidTurn(chat: Chat): Chat {
  return { ...chat, turn: TurnState.Running };
}

export function applyEvent(current: Chat, event: AgentEvent): Chat {
  // Every other event arrives during a turn, which can be one this view hasn't yet heard started.
  const chat =
    event.kind !== AgentEventKind.TurnEnded && current.turn === TurnState.Idle
      ? { ...current, turn: TurnState.Running }
      : current;
  switch (event.kind) {
    case AgentEventKind.AssistantTextDelta: {
      const block = streamingBlock(chat);
      return block
        ? replaceLast(chat, { ...block, text: block.text + event.text })
        : push(chat, (key) => ({
            key,
            kind: ItemKind.Assistant,
            text: event.text,
            streaming: true,
          }));
    }
    case AgentEventKind.AssistantText: {
      const block = streamingBlock(chat);
      return block
        ? replaceLast(chat, { ...block, text: event.text, streaming: false })
        : push(chat, (key) => ({
            key,
            kind: ItemKind.Assistant,
            text: event.text,
            streaming: false,
          }));
    }
    case AgentEventKind.ToolStarted:
      return push(chat, (key) => ({
        key,
        kind: ItemKind.Tool,
        toolCallId: event.toolCallId,
        name: event.name,
        input: event.input,
        output: undefined,
        status: ToolStatus.Running,
      }));
    case AgentEventKind.ToolFinished:
      return {
        ...chat,
        items: chat.items.map((item) =>
          item.kind === ItemKind.Tool && item.toolCallId === event.toolCallId
            ? {
                ...item,
                output: event.output,
                status: event.isError ? ToolStatus.Failed : ToolStatus.Done,
              }
            : item,
        ),
      };
    case AgentEventKind.Error:
      return push(chat, (key) => ({
        key,
        kind: ItemKind.Error,
        message: event.message,
        needsResume: event.needsResume,
        refused: false,
      }));
    case AgentEventKind.TurnEnded: {
      const closed: Chat = {
        ...chat,
        turn: TurnState.Idle,
        items: chat.items.map((item) => {
          if (item.kind === ItemKind.Assistant && item.streaming)
            return { ...item, streaming: false };
          if (item.kind === ItemKind.Tool && item.status === ToolStatus.Running)
            return { ...item, status: ToolStatus.Unfinished };
          return item;
        }),
      };
      return event.interrupted
        ? push(closed, (key) => ({ key, kind: ItemKind.Stopped }))
        : closed;
    }
    default:
      throw new Error(`unknown event kind: ${event satisfies never}`);
  }
}

export function turnStatus(chat: Chat): string {
  switch (chat.turn) {
    case TurnState.Running:
      return "Claude is working…";
    case TurnState.Stopping:
      return "Stopping…";
    case TurnState.Idle: {
      if (chat.items.length === 0) return "";
      // A conversation resumed mid-turn has a turn with no message of the user's.
      const lastSent = chat.items.findLastIndex(
        (item) => item.kind === ItemKind.User,
      );
      // A refused send's error follows the turn before it.
      const outcome = chat.items
        .slice(Math.max(lastSent, 0))
        .findLast(
          (item) =>
            item.kind === ItemKind.Stopped || item.kind === ItemKind.Error,
        );
      if (outcome?.kind === ItemKind.Stopped) return "Stopped.";
      if (outcome?.kind === ItemKind.Error) return "Claude ran into a problem.";
      return "Claude finished.";
    }
    default:
      throw new Error(`unknown turn state: ${chat.turn satisfies never}`);
  }
}

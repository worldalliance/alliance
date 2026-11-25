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

export enum TurnOutcome {
  Finished = "finished",
  Stopped = "stopped",
  Problem = "problem",
  NotSent = "not-sent",
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
      /** True when the session refused the message, so the agent never got it. */
      refused: boolean;
    }
  | { kind: ItemKind.Stopped; key: number };

export type Chat = {
  items: readonly ChatItem[];
  turn: TurnState;
  nextKey: number;
  // Recorded rather than read from the items, since a turn resumed midway has no message of the user's among them.
  /** How the latest turn went so far; undefined before any turn. */
  outcome: TurnOutcome | undefined;
  /** The nextKey at the last reopen: errors keyed below it came before it, so reopening no longer applies to them. */
  reopenedAt: number;
};

export const emptyChat: Chat = {
  items: [],
  turn: TurnState.Idle,
  nextKey: 0,
  outcome: undefined,
  reopenedAt: 0,
};

function push(chat: Chat, item: (key: number) => ChatItem): Chat {
  return {
    ...chat,
    items: [...chat.items, item(chat.nextKey)],
    nextKey: chat.nextKey + 1,
  };
}

function replaceAt(params: {
  chat: Chat;
  index: number;
  item: ChatItem;
}): Chat {
  return {
    ...params.chat,
    items: params.chat.items.with(params.index, params.item),
  };
}

// A recoverable error can arrive mid-block, and the block's later deltas still extend it.
const endsBlock: Record<ItemKind, boolean> = {
  [ItemKind.User]: true,
  [ItemKind.Assistant]: true,
  [ItemKind.Tool]: true,
  [ItemKind.Error]: false,
  [ItemKind.Stopped]: true,
};

const streamingBlock = (chat: Chat) => {
  const index = chat.items.findLastIndex((item) => endsBlock[item.kind]);
  const item = chat.items[index];
  return item?.kind === ItemKind.Assistant && item.streaming
    ? { item, index }
    : undefined;
};

function running(chat: Chat): Chat {
  switch (chat.turn) {
    case TurnState.Idle:
      return {
        ...chat,
        turn: TurnState.Running,
        outcome: TurnOutcome.Finished,
      };
    case TurnState.Running:
    case TurnState.Stopping:
      return chat;
    default:
      throw new Error(`unknown turn state: ${chat.turn satisfies never}`);
  }
}

export function sendMessage(chat: Chat, text: string): Chat {
  return running(push(chat, (key) => ({ key, kind: ItemKind.User, text })));
}

/** A start's events can reach the renderer before start resolves, so its first message goes ahead of any already applied. */
export function firstMessage(chat: Chat | undefined, text: string): Chat {
  if (!chat) return sendMessage(emptyChat, text);
  return {
    ...chat,
    items: [{ key: chat.nextKey, kind: ItemKind.User, text }, ...chat.items],
    nextKey: chat.nextKey + 1,
  };
}

/** A send the session refused never started a turn, so its message leaves the transcript, and its error offers a reopen. */
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
      // The session refuses only a message the view thought it could send, such as one sent while the session still runs a turn, so the view is out of step and reopening brings it back in step.
      needsResume: true,
      refused: true,
    })),
    turn: TurnState.Idle,
    outcome: TurnOutcome.NotSent,
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

export const offersReopen = (chat: Chat, item: ChatItem): boolean =>
  item.key >= chat.reopenedAt;

/** A resumed session can already be mid-turn, having sent events this view never heard. */
export function resumedMidTurn(chat: Chat): Chat {
  return running(chat);
}

const closesUnfinished: Record<ToolStatus, boolean> = {
  [ToolStatus.Running]: true,
  [ToolStatus.Done]: false,
  [ToolStatus.Failed]: false,
  [ToolStatus.Unfinished]: false,
};

function closeItem(item: ChatItem): ChatItem {
  switch (item.kind) {
    case ItemKind.Assistant:
      return item.streaming ? { ...item, streaming: false } : item;
    case ItemKind.Tool:
      return closesUnfinished[item.status]
        ? { ...item, status: ToolStatus.Unfinished }
        : item;
    case ItemKind.User:
    case ItemKind.Error:
    case ItemKind.Stopped:
      return item;
    default:
      throw new Error(`unknown item kind: ${item satisfies never}`);
  }
}

export function applyEvent(current: Chat, event: AgentEvent): Chat {
  // Each event belongs to a turn, which can be one this view hasn't yet heard started.
  const chat = running(current);
  switch (event.kind) {
    case AgentEventKind.AssistantTextDelta: {
      const block = streamingBlock(chat);
      return block
        ? replaceAt({
            chat,
            index: block.index,
            item: { ...block.item, text: block.item.text + event.text },
          })
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
        ? replaceAt({
            chat,
            index: block.index,
            item: { ...block.item, text: event.text, streaming: false },
          })
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
      return push({ ...chat, outcome: TurnOutcome.Problem }, (key) => ({
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
        items: chat.items.map(closeItem),
      };
      return event.interrupted
        ? push({ ...closed, outcome: TurnOutcome.Stopped }, (key) => ({
            key,
            kind: ItemKind.Stopped,
          }))
        : closed;
    }
    default:
      throw new Error(`unknown event kind: ${event satisfies never}`);
  }
}

const outcomeStatus = (agentName: string): Record<TurnOutcome, string> => ({
  [TurnOutcome.Finished]: `${agentName} finished.`,
  [TurnOutcome.Stopped]: "Stopped.",
  [TurnOutcome.Problem]: `${agentName} ran into a problem.`,
  [TurnOutcome.NotSent]: "Your message wasn't sent.",
});

export function turnStatus(chat: Chat, agentName: string): string {
  switch (chat.turn) {
    case TurnState.Running:
      return `${agentName} is working…`;
    case TurnState.Stopping:
      return "Stopping…";
    case TurnState.Idle:
      return chat.outcome ? outcomeStatus(agentName)[chat.outcome] : "";
    default:
      throw new Error(`unknown turn state: ${chat.turn satisfies never}`);
  }
}

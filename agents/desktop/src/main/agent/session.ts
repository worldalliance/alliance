import type { Result } from "../../../../../common/src/result";

export enum ImageMediaType {
  Png = "image/png",
  Jpeg = "image/jpeg",
  Gif = "image/gif",
  Webp = "image/webp",
}

export type ImageInput = {
  mediaType: ImageMediaType;
  data: Uint8Array;
};

export type AgentMessage = {
  text: string;
  images: readonly ImageInput[];
};

export enum AgentEventKind {
  AssistantText = "assistant_text",
  AssistantTextDelta = "assistant_text_delta",
  ToolStarted = "tool_started",
  ToolFinished = "tool_finished",
  TurnEnded = "turn_ended",
  Error = "error",
}

/** ToolStarted's name and input differ by CLI, so they are for generic display only. */
export type AgentEvent =
  | { kind: AgentEventKind.AssistantText; text: string }
  | { kind: AgentEventKind.AssistantTextDelta; text: string }
  | {
      kind: AgentEventKind.ToolStarted;
      toolCallId: string;
      name: string;
      input: unknown;
    }
  | {
      kind: AgentEventKind.ToolFinished;
      toolCallId: string;
      output: string;
      isError: boolean;
    }
  | { kind: AgentEventKind.TurnEnded }
  | { kind: AgentEventKind.Error; message: string };

export type AgentEventListener = (event: AgentEvent) => void;

/** One conversation with a CLI in one worktree. Every turn ends with exactly one TurnEnded event, an interrupted or failed one included, and it closes any tool still open, since a ToolStarted can go without a ToolFinished. Every other event arrives during a turn, so a CLI that exits between turns is reported on the next send, as Error then TurnEnded. A session whose CLI has exited is no longer live, and its sends keep reporting that way; a caller recovers from any Error by resuming, which returns this same session if its CLI is still running. A text block arrives as any number of AssistantTextDelta events, each extending it, then one AssistantText holding the whole block, which replaces those deltas. TurnEnded also closes a block left without its AssistantText, as an interrupted turn can do. */
export interface AgentSession {
  /** The CLI's own session id, unchanged by resume. */
  readonly id: string;
  /** True from a successful send until the turn's TurnEnded, whose listeners can already send again. */
  readonly turnRunning: boolean;
  /** Fails while a turn is running. Emits no event before returning. */
  send(message: AgentMessage): Result<void, Error>;
  /** Asks the running turn to stop. Emits no event before returning, and send fails until the turn's TurnEnded. The interrupt itself emits no Error. A no-op between turns. */
  interrupt(): void;
  /** Delivers only events after the call; nothing is replayed. A listener that throws is logged; the other listeners and the turn's TurnEnded still arrive. */
  subscribe(listener: AgentEventListener): () => void;
}

export interface AgentBackend {
  start(params: { cwd: string }): Promise<Result<AgentSession, Error>>;
  /** Returns the session already live in this process for sessionId, which may be mid-turn, if there is one; otherwise starts the CLI on its saved session in cwd and returns a new session. Concurrent calls for one sessionId resolve to the same session. */
  resume(params: {
    cwd: string;
    sessionId: string;
  }): Promise<Result<AgentSession, Error>>;
}

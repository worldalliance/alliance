import type { Result } from "../result";

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
  ToolStarted = "tool_started",
  ToolFinished = "tool_finished",
  TurnEnded = "turn_ended",
  Error = "error",
}

export type AgentEvent =
  | { kind: AgentEventKind.AssistantText; text: string }
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

/** One conversation with a CLI in one worktree. Every turn ends with exactly one TurnEnded event, an interrupted or failed one included. Every other event arrives during a turn, so a CLI that exits between turns is reported on the next send, as Error then TurnEnded. AssistantText carries a complete text block, never a delta. */
export interface AgentSession {
  /** The CLI's own session id, unchanged by resume. */
  readonly id: string;
  /** Throws while a turn is running. */
  send(message: AgentMessage): void;
  /** Asks the running turn to stop. Its TurnEnded may arrive after this returns, and send throws until it does. A no-op between turns. */
  interrupt(): void;
  /** A listener that throws is logged; the other listeners and the turn's TurnEnded still arrive. */
  subscribe(listener: AgentEventListener): () => void;
}

/** Implemented once per CLI, so the UI never sees vendor types. */
export interface AgentBackend {
  start(params: { cwd: string }): Promise<Result<AgentSession, Error>>;
  /** Returns the session already live in this process for sessionId, which may be mid-turn, if there is one; otherwise starts the CLI on its saved session in cwd. */
  resume(params: {
    cwd: string;
    sessionId: string;
  }): Promise<Result<AgentSession, Error>>;
}

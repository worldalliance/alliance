import type { Result } from "../../../../../common/src/result";
import type { AgentEvent } from "../../shared/agent-event";

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

export type AgentEventListener = (event: AgentEvent) => void;

/** One conversation with a CLI in one worktree, whose turns emit AgentEvents. A CLI that exits between turns is reported on the next send, as Error then TurnEnded. A session whose CLI has exited is no longer live, and its sends keep reporting that way; an Error says whether it left the session so, and resume then returns a new live session. Resuming returns this same session while it is still live. */
export interface AgentSession {
  /** The CLI's own session id, unchanged by resume. */
  readonly id: string;
  /** True from a successful send until the turn's TurnEnded, whose listeners can already send again. */
  readonly turnRunning: boolean;
  /** Fails while a turn is running. Emits no event before returning. */
  send(message: AgentMessage): Result<void, Error>;
  /** Asks the running turn to stop. Emits no event before returning, and send fails until the turn's TurnEnded. The interrupt itself emits no Error. A no-op between turns. */
  interrupt(): void;
  /** Delivers only events after the call; nothing is replayed. A listener that throws is logged; the other listeners and the turn's TurnEnded still arrive. Each call is its own subscription: one added during a dispatch first hears the next event, and one removed during a dispatch before its delivery doesn't hear the event in flight. */
  subscribe(listener: AgentEventListener): () => void;
  /** Ends the CLI and resolves once it has exited. A running turn ends with its TurnEnded, and no Error, before the promise resolves. The session is no longer live from the call on: resume waits for the CLI to exit, then starts it again, and sends report Error then TurnEnded. Later calls return the first call's promise. */
  close(): Promise<void>;
}

export interface AgentBackend {
  start(params: { cwd: string }): Promise<Result<AgentSession, Error>>;
  /** Returns the session already live in this process for sessionId, which may be mid-turn, if there is one; otherwise starts the CLI on its saved session in cwd and returns a new session. Concurrent calls for one sessionId resolve to the same session. */
  resume(params: {
    cwd: string;
    sessionId: string;
  }): Promise<Result<AgentSession, Error>>;
}

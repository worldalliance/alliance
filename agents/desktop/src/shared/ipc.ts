import type { Result } from "../../../../common/src/result";
import type { AgentEvent } from "./agent-event";
import type { Conversation } from "./conversation";

export type { Conversation } from "./conversation";

export enum IpcChannel {
  ClaudeStatus = "claude:status",
  SignIn = "claude:sign-in",
  CancelSignIn = "claude:cancel-sign-in",
  ChooseFolder = "folder:choose",
  ListConversations = "conversations:list",
  Start = "session:start",
  Resume = "session:resume",
  Send = "session:send",
  Interrupt = "session:interrupt",
  Event = "session:event",
}

export type IpcResult<T> = Result<T, string>;

export type SessionEvent = { sessionId: string; event: AgentEvent };

/** A method returning an IpcResult resolves to a failure when its handler throws. */
export type AgentApi = {
  claudeSignedIn(): Promise<IpcResult<boolean>>;
  /** Resolves once the browser sign-in finishes, fails or is cancelled. */
  signIn(): Promise<IpcResult<void>>;
  cancelSignIn(): void;
  chooseFolder(): Promise<string | undefined>;
  listConversations(): Promise<IpcResult<Conversation[]>>;
  /** Starts a conversation, saves it titled with its first message, and sends that message, so no conversation is saved without one. That message's events can arrive before this resolves. */
  start(input: {
    folder: string;
    firstMessage: string;
  }): Promise<IpcResult<Conversation>>;
  /** turnRunning is true when the session was still live and mid-turn. */
  resume(
    sessionId: string,
  ): Promise<IpcResult<{ conversation: Conversation; turnRunning: boolean }>>;
  send(input: { sessionId: string; text: string }): Promise<IpcResult<void>>;
  interrupt(sessionId: string): void;
  onEvent(listener: (event: SessionEvent) => void): () => void;
};

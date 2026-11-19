import type { Result } from "../../../../common/src/result";
import type { AgentEvent } from "./agent-event";
import type { AgentKind } from "./agent-kind";
import type { Conversation } from "./conversation";

export type { Conversation } from "./conversation";

export enum IpcChannel {
  SignInStatus = "agent:status",
  SignIn = "agent:sign-in",
  CancelSignIn = "agent:cancel-sign-in",
  ChooseFolder = "folder:choose",
  ListConversations = "conversations:list",
  Start = "session:start",
  Resume = "session:resume",
  Send = "session:send",
  Interrupt = "session:interrupt",
  Event = "session:event",
  ConversationRemoved = "conversation:removed",
}

export type IpcResult<T> = Result<T, string>;

export type SessionEvent = { sessionId: string; event: AgentEvent };

/** What each channel the main process pushes to the window carries. */
export type RendererEvents = {
  [IpcChannel.Event]: SessionEvent;
  /** The id of a new conversation removed because its CLI exited before reading its first message. */
  [IpcChannel.ConversationRemoved]: string;
};

/** What each invoked channel's main-process handler returns. */
export type IpcReplies = {
  [IpcChannel.SignInStatus]: IpcResult<boolean>;
  [IpcChannel.SignIn]: IpcResult<void>;
  [IpcChannel.ChooseFolder]: IpcResult<string | undefined>;
  [IpcChannel.ListConversations]: IpcResult<Conversation[]>;
  [IpcChannel.Start]: IpcResult<Conversation>;
  [IpcChannel.Resume]: IpcResult<{
    conversation: Conversation;
    turnRunning: boolean;
  }>;
  [IpcChannel.Send]: IpcResult<void>;
};

type Reply<C extends keyof IpcReplies> = Promise<IpcReplies[C]>;

/** A method returning an IpcResult resolves to a failure when its handler throws. */
export type AgentApi = {
  signedIn(agent: AgentKind): Reply<IpcChannel.SignInStatus>;
  /** Resolves once the browser sign-in finishes, fails or is cancelled. */
  signIn(agent: AgentKind): Reply<IpcChannel.SignIn>;
  cancelSignIn(agent: AgentKind): void;
  /** Succeeds with undefined when the user cancels. */
  chooseFolder(): Reply<IpcChannel.ChooseFolder>;
  listConversations(): Reply<IpcChannel.ListConversations>;
  /** Starts a conversation, saves it titled with its first message, and sends that message, so no conversation is saved without one. That message's events can arrive before this resolves. */
  start(input: {
    folder: string;
    firstMessage: string;
    agent: AgentKind;
  }): Reply<IpcChannel.Start>;
  /** turnRunning is true when the session was still live and mid-turn. */
  resume(sessionId: string): Reply<IpcChannel.Resume>;
  send(input: { sessionId: string; text: string }): Reply<IpcChannel.Send>;
  interrupt(sessionId: string): void;
  onEvent(listener: (event: SessionEvent) => void): () => void;
  /** Hears the id of a new conversation removed because its CLI exited before reading its first message. */
  onConversationRemoved(listener: (id: string) => void): () => void;
};

import type { Result } from "../../../../common/src/result";
import type { AgentEvent } from "./agent-event";
import type { AgentKind } from "./agent-kind";
import type { Conversation } from "./conversation";
import type { Problem, RepositoryState } from "./repository";
import type { WorktreesState } from "./worktree";

export type { Conversation } from "./conversation";

export enum IpcChannel {
  SignInStatus = "agent:status",
  SignIn = "agent:sign-in",
  CancelSignIn = "agent:cancel-sign-in",
  ListConversations = "conversations:list",
  Start = "session:start",
  Resume = "session:resume",
  Send = "session:send",
  Interrupt = "session:interrupt",
  Event = "session:event",
  ConversationRemoved = "conversation:removed",
  RepositoryState = "repository:state",
  RepositoryChanged = "repository:changed",
  RepositoryClone = "repository:clone",
  RepositoryChangeCloneFolder = "repository:change-clone-folder",
  RepositoryCancelClone = "repository:cancel-clone",
  RepositoryCancelUpdate = "repository:cancel-update",
  RepositoryUseExisting = "repository:use-existing",
  RepositoryUpdate = "repository:update",
  RepositoryCheckAgain = "repository:check-again",
  WorktreesState = "worktrees:state",
  WorktreesChanged = "worktrees:changed",
  CreateWorktree = "worktree:create",
  RetryWorktree = "worktree:retry",
  DismissWorktree = "worktree:dismiss",
  ArchiveWorktree = "worktree:archive",
  RestoreWorktree = "worktree:restore",
}

export type IpcResult<T> = Result<T, string>;

/** Succeeds with the problem that stopped a repository action, or undefined once it is done or the user cancelled its folder picker. */
export type RepositoryReply = IpcResult<Problem | undefined>;

export type StartInput = {
  folder: string;
  firstMessage: string;
  agent: AgentKind;
};

export type CreatedWorktree = { key: string; folder: string };

export type SessionEvent = { sessionId: string; event: AgentEvent };

/** What each channel the main process pushes to the window carries. */
export type RendererEvents = {
  [IpcChannel.Event]: SessionEvent;
  /** The id of a new conversation removed because its CLI exited before reading its first message. */
  [IpcChannel.ConversationRemoved]: string;
  [IpcChannel.RepositoryChanged]: RepositoryState;
  [IpcChannel.WorktreesChanged]: WorktreesState;
};

/** What each invoked channel's main-process handler returns. */
export type IpcReplies = {
  [IpcChannel.SignInStatus]: IpcResult<boolean>;
  [IpcChannel.SignIn]: IpcResult<void>;
  [IpcChannel.ListConversations]: IpcResult<Conversation[]>;
  [IpcChannel.Start]: IpcResult<Conversation>;
  [IpcChannel.Resume]: IpcResult<{
    conversation: Conversation;
    turnRunning: boolean;
  }>;
  [IpcChannel.Send]: IpcResult<void>;
  [IpcChannel.RepositoryState]: IpcResult<RepositoryState>;
  [IpcChannel.RepositoryClone]: RepositoryReply;
  [IpcChannel.RepositoryChangeCloneFolder]: RepositoryReply;
  [IpcChannel.RepositoryUseExisting]: RepositoryReply;
  [IpcChannel.RepositoryUpdate]: RepositoryReply;
  [IpcChannel.RepositoryCheckAgain]: RepositoryReply;
  [IpcChannel.WorktreesState]: IpcResult<WorktreesState>;
  [IpcChannel.CreateWorktree]: IpcResult<CreatedWorktree>;
  [IpcChannel.RetryWorktree]: IpcResult<CreatedWorktree>;
  [IpcChannel.ArchiveWorktree]: IpcResult<void>;
  [IpcChannel.RestoreWorktree]: IpcResult<void>;
};

type Reply<C extends keyof IpcReplies> = Promise<IpcReplies[C]>;

/** A method returning an IpcResult resolves to a failure when its handler throws. */
export type AgentApi = {
  signedIn(agent: AgentKind): Reply<IpcChannel.SignInStatus>;
  /** Resolves once the browser sign-in finishes, fails or is cancelled. */
  signIn(agent: AgentKind): Reply<IpcChannel.SignIn>;
  cancelSignIn(agent: AgentKind): void;
  listConversations(): Reply<IpcChannel.ListConversations>;
  /** Starts a conversation, saves it titled with its first message, and sends that message, so no conversation is saved without one. That message's events can arrive before this resolves. */
  start(input: StartInput): Reply<IpcChannel.Start>;
  /** turnRunning is true when the session was still live and mid-turn. */
  resume(sessionId: string): Reply<IpcChannel.Resume>;
  send(input: { sessionId: string; text: string }): Reply<IpcChannel.Send>;
  interrupt(sessionId: string): void;
  onEvent(listener: (event: SessionEvent) => void): () => void;
  /** Hears the id of a new conversation removed because its CLI exited before reading its first message. */
  onConversationRemoved(listener: (id: string) => void): () => void;
  repositoryState(): Reply<IpcChannel.RepositoryState>;
  onRepositoryChanged(listener: (state: RepositoryState) => void): () => void;
  /** Clones into the folder a not-set-up state names. */
  cloneRepository(): Reply<IpcChannel.RepositoryClone>;
  /** Picks the folder to clone into, restarting a clone in progress there. */
  changeCloneFolder(): Reply<IpcChannel.RepositoryChangeCloneFolder>;
  cancelClone(): void;
  /** Stops an update's download; once git is fast-forwarding, the update finishes. */
  cancelUpdate(): void;
  /** Picks an existing copy of the repository and saves it as the user's choice. */
  useExistingRepository(): Reply<IpcChannel.RepositoryUseExisting>;
  /** Fast-forwards an outdated copy to the latest main, resolving once done. */
  updateRepository(): Reply<IpcChannel.RepositoryUpdate>;
  checkRepositoryAgain(): Reply<IpcChannel.RepositoryCheckAgain>;
  worktreesState(): Reply<IpcChannel.WorktreesState>;
  onWorktreesChanged(listener: (state: WorktreesState) => void): () => void;
  /** Creates a worktree named after name; it is listed as new:<creationId> meanwhile, and stays listed with its problem if creation fails. */
  createWorktree(input: {
    creationId: string;
    name: string;
  }): Reply<IpcChannel.CreateWorktree>;
  retryWorktree(key: string): Reply<IpcChannel.RetryWorktree>;
  dismissWorktree(key: string): void;
  /** Stops the worktree's agents, then hides it. */
  archiveWorktree(key: string): Reply<IpcChannel.ArchiveWorktree>;
  restoreWorktree(key: string): Reply<IpcChannel.RestoreWorktree>;
};

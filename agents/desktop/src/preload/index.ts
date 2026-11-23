import { contextBridge, ipcRenderer } from "electron";
import { R } from "../../../../common/src/result";
import {
  type AgentApi,
  IpcChannel,
  type IpcReplies,
  type RendererEvents,
} from "../shared/ipc";

const invoke = <C extends keyof IpcReplies>(
  channel: C,
  arg?: unknown,
): Promise<IpcReplies[C]> =>
  ipcRenderer
    .invoke(channel, arg)
    .catch((error: unknown) => R.failure(R.toError(error).message));

const listen = <C extends keyof RendererEvents>(
  channel: C,
  listener: (payload: RendererEvents[C]) => void,
) => {
  const handler = (_: unknown, payload: RendererEvents[C]) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
};

const api: AgentApi = {
  signedIn: (agent) => invoke(IpcChannel.SignInStatus, agent),
  signIn: (agent) => invoke(IpcChannel.SignIn, agent),
  cancelSignIn: (agent) => ipcRenderer.send(IpcChannel.CancelSignIn, agent),
  listConversations: () => invoke(IpcChannel.ListConversations),
  start: (input) => invoke(IpcChannel.Start, input),
  resume: (sessionId) => invoke(IpcChannel.Resume, sessionId),
  send: (input) => invoke(IpcChannel.Send, input),
  interrupt: (sessionId) => ipcRenderer.send(IpcChannel.Interrupt, sessionId),
  onEvent: (listener) => listen(IpcChannel.Event, listener),
  onConversationRemoved: (listener) =>
    listen(IpcChannel.ConversationRemoved, listener),
  repositoryState: () => invoke(IpcChannel.RepositoryState),
  onRepositoryChanged: (listener) =>
    listen(IpcChannel.RepositoryChanged, listener),
  cloneRepository: () => invoke(IpcChannel.RepositoryClone),
  changeCloneFolder: () => invoke(IpcChannel.RepositoryChangeCloneFolder),
  cancelClone: () => ipcRenderer.send(IpcChannel.RepositoryCancelClone),
  cancelUpdate: () => ipcRenderer.send(IpcChannel.RepositoryCancelUpdate),
  useExistingRepository: () => invoke(IpcChannel.RepositoryUseExisting),
  updateRepository: () => invoke(IpcChannel.RepositoryUpdate),
  checkRepositoryAgain: () => invoke(IpcChannel.RepositoryCheckAgain),
  tasksState: () => invoke(IpcChannel.TasksState),
  onTasksChanged: (listener) => listen(IpcChannel.TasksChanged, listener),
  createTask: (input) => invoke(IpcChannel.CreateTask, input),
  retryTask: (key) => invoke(IpcChannel.RetryTask, key),
  dismissTask: (key) => ipcRenderer.send(IpcChannel.DismissTask, key),
  archiveTask: (key) => invoke(IpcChannel.ArchiveTask, key),
  restoreTask: (key) => invoke(IpcChannel.RestoreTask, key),
};

contextBridge.exposeInMainWorld("agent", api);

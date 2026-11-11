import { contextBridge, ipcRenderer } from "electron";
import { R } from "../../../../common/src/result";
import {
  type AgentApi,
  IpcChannel,
  type IpcResult,
  type SessionEvent,
} from "../shared/ipc";

// invoke rejects when a handler throws, which the page would otherwise never hear about.
const invoke = <T>(channel: IpcChannel, arg?: unknown): Promise<IpcResult<T>> =>
  ipcRenderer
    .invoke(channel, arg)
    .catch((error: unknown) => R.failure(R.toError(error).message));

const api: AgentApi = {
  claudeSignedIn: () => invoke(IpcChannel.ClaudeStatus),
  signIn: () => invoke(IpcChannel.SignIn),
  cancelSignIn: () => ipcRenderer.send(IpcChannel.CancelSignIn),
  chooseFolder: () => ipcRenderer.invoke(IpcChannel.ChooseFolder),
  listConversations: () => invoke(IpcChannel.ListConversations),
  start: (input) => invoke(IpcChannel.Start, input),
  resume: (sessionId) => invoke(IpcChannel.Resume, sessionId),
  send: (input) => invoke(IpcChannel.Send, input),
  interrupt: (sessionId) => ipcRenderer.send(IpcChannel.Interrupt, sessionId),
  onEvent: (listener) => {
    const handler = (_: unknown, event: SessionEvent) => listener(event);
    ipcRenderer.on(IpcChannel.Event, handler);
    return () => ipcRenderer.off(IpcChannel.Event, handler);
  },
};

contextBridge.exposeInMainWorld("agent", api);

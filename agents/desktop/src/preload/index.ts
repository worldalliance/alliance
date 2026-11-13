import { contextBridge, ipcRenderer } from "electron";
import { R } from "../../../../common/src/result";
import {
  type AgentApi,
  IpcChannel,
  type IpcReplies,
  type SessionEvent,
} from "../shared/ipc";

const invoke = <C extends keyof IpcReplies>(
  channel: C,
  arg?: unknown,
): Promise<IpcReplies[C]> =>
  ipcRenderer
    .invoke(channel, arg)
    .catch((error: unknown) => R.failure(R.toError(error).message));

const api: AgentApi = {
  claudeSignedIn: () => invoke(IpcChannel.ClaudeStatus),
  signIn: () => invoke(IpcChannel.SignIn),
  cancelSignIn: () => ipcRenderer.send(IpcChannel.CancelSignIn),
  chooseFolder: () => invoke(IpcChannel.ChooseFolder),
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

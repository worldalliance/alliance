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
  claudeSignedIn: () => invoke(IpcChannel.ClaudeStatus),
  signIn: () => invoke(IpcChannel.SignIn),
  cancelSignIn: () => ipcRenderer.send(IpcChannel.CancelSignIn),
  chooseFolder: () => invoke(IpcChannel.ChooseFolder),
  listConversations: () => invoke(IpcChannel.ListConversations),
  start: (input) => invoke(IpcChannel.Start, input),
  resume: (sessionId) => invoke(IpcChannel.Resume, sessionId),
  send: (input) => invoke(IpcChannel.Send, input),
  interrupt: (sessionId) => ipcRenderer.send(IpcChannel.Interrupt, sessionId),
  onEvent: (listener) => listen(IpcChannel.Event, listener),
};

contextBridge.exposeInMainWorld("agent", api);

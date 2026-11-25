import {
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import type { IpcChannel, IpcReplies, RendererEvents } from "../shared/ipc";
import { fromRendererOnly, isRendererFrame } from "./renderer-frame";

/** IPC limited to the app's own top-level page, loaded from rendererUrl, per Electron's security checklist, so a frame that slips past the CSP or navigation lock can't reach the main process. */
export function rendererIpc(rendererUrl: string) {
  const handle = <C extends keyof IpcReplies>(
    channel: C,
    listener: (
      event: IpcMainInvokeEvent,
      arg: unknown,
    ) => IpcReplies[C] | Promise<IpcReplies[C]>,
  ) =>
    ipcMain.handle(
      channel,
      fromRendererOnly({
        rendererUrl,
        listener,
        refuse: () => {
          throw new Error(`${channel} called from outside the app's page`);
        },
      }),
    );
  const on = (channel: IpcChannel, listener: (arg: unknown) => void) =>
    ipcMain.on(
      channel,
      fromRendererOnly({
        rendererUrl,
        listener: (_event: IpcMainEvent, arg: unknown) => listener(arg),
        refuse: () =>
          console.error(`${channel} sent from outside the app's page`),
      }),
    );
  const toRenderer = <C extends keyof RendererEvents>(
    channel: C,
    payload: RendererEvents[C],
  ) => {
    for (const { webContents } of BrowserWindow.getAllWindows())
      if (isRendererFrame({ frame: webContents.mainFrame, rendererUrl }))
        webContents.send(channel, payload);
  };
  return { handle, on, toRenderer };
}

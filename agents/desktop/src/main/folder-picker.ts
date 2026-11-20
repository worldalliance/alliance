import { BrowserWindow, dialog, type IpcMainInvokeEvent } from "electron";
import { R, type Result } from "../../../../common/src/result";

/** Shows the folder picker over the calling window; succeeds with undefined when the user cancels. */
export async function pickFolder(
  event: IpcMainInvokeEvent,
): Promise<Result<string | undefined, Error>> {
  const window = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"],
  };
  const chosen = await R.fromPromise(
    window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options),
  );
  return R.map(chosen, ({ canceled, filePaths }) =>
    canceled ? undefined : filePaths[0],
  );
}

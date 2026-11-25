import type { ElectronApplication } from "@playwright/test";

export const crashRenderer = (app: ElectronApplication): Promise<void> =>
  app.evaluate(async ({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) throw new Error("the app has no window");
    const gone = new Promise<void>((resolve) =>
      window.webContents.once("render-process-gone", () => resolve()),
    );
    window.webContents.forcefullyCrashRenderer();
    await gone;
  });

import { app, BrowserWindow, dialog, net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rendererDir = path.join(import.meta.dirname, "../renderer");
// Set by the e2e tests, so each test's app opens no window or dock icon on screen.
const headless = process.env.ALLIANCE_AGENT_HEADLESS === "1";

// Under file:// the CSP's 'self' admits every file on disk; app:// limits it to rendererDir.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true } },
]);

// Decoding turns "..%2F" into "../", so the decoded path is checked against rendererDir.
function serveRenderer(request: Request): Promise<Response> {
  const file = path.join(
    rendererDir,
    decodeURIComponent(new URL(request.url).pathname),
  );
  const relative = path.relative(rendererDir, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`))
    return Promise.resolve(new Response(null, { status: 404 }));
  return net.fetch(pathToFileURL(file).toString());
}

function createWindow(): void {
  const window = new BrowserWindow({ width: 1200, height: 800, show: false });
  if (!headless) window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, url, isMainFrame) => {
      // -3 is ERR_ABORTED: a reload or navigation replaced the load before it finished.
      if (!isMainFrame || errorCode === -3) return;
      const message = `Alliance agent couldn't load its window: ${errorDescription} (${errorCode}) loading ${url}`;
      console.error(message);
      if (!headless) {
        dialog.showErrorBox("Alliance agent couldn't load its window", message);
      }
      app.exit(1);
    },
  );

  // did-fail-load reports failures; the promise also rejects for aborted loads.
  // A packaged app ignores ELECTRON_RENDERER_URL, so its launch environment can't load a remote page.
  window
    .loadURL(
      (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) ||
        "app://renderer/index.html",
    )
    .catch(() => undefined);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void app.whenReady().then(() => {
  if (headless) app.dock?.hide();
  protocol.handle("app", serveRenderer);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

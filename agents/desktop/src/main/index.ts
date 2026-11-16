import { app, BrowserWindow, dialog, net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { R } from "../../../../common/src/result";
import { createClaudeBackend } from "./agent/claude/backend";
import { findClaudeExecutable } from "./claude-executable";
import { ConversationStore } from "./conversations";
import { describeError } from "./describe-error";
import { devClaudeConfigDir } from "./dev-app-data";
import { registerIpc } from "./ipc";

const rendererDir = path.join(import.meta.dirname, "../renderer");
// Set by the e2e tests, so each test's app opens no window or dock icon on screen.
const headless = process.env.ALLIANCE_AGENT_HEADLESS === "1";
// Caps the quit's wait for sessions still starting, which a hung network folder can stall. The quit hides the app first, so an endless wait would leave an invisible app holding the lock. The e2e tests shorten it.
const openingWaitMs = z.coerce
  .number()
  .int()
  .positive()
  .default(30_000)
  .parse(
    app.isPackaged ? undefined : process.env.ALLIANCE_AGENT_OPENING_WAIT_MS,
  );
// A packaged app ignores ELECTRON_RENDERER_URL, so its launch environment can't load a remote page.
const rendererUrl =
  (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) ||
  "app://renderer/index.html";

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

function exitUnloaded(cause: string): void {
  const message = `Alliance agent couldn't load its window: ${cause}`;
  console.error(message);
  if (closing) return;
  // app.exit skips before-quit, so the sessions close here first.
  closing = (closeSessions?.() ?? Promise.resolve()).finally(() => app.exit(1));
  if (!headless) {
    dialog.showErrorBox("Alliance agent couldn't load its window", message);
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/index.cjs"),
    },
  });
  if (!headless)
    window.once("ready-to-show", () => {
      if (!hiddenForQuit) window.show();
    });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, url, isMainFrame) => {
      // -3 is ERR_ABORTED: a reload or navigation replaced the load before it finished.
      if (!isMainFrame || errorCode === -3) return;
      exitUnloaded(`${errorDescription} (${errorCode}) loading ${url}`);
    },
  );
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    // The stack says where the preload threw, which the exit leaves no devtools to show.
    if (error instanceof Error) console.error(error);
    exitUnloaded(`${describeError(error)} in ${preloadPath}`);
  });

  // did-fail-load reports failures; the promise also rejects for aborted loads.
  window.loadURL(rendererUrl).catch(() => undefined);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

const devData = !app.isPackaged && !app.commandLine.hasSwitch("user-data-dir");

// The lock belongs to the user data folder, so each checkout's unpackaged app keeps its own, inside the checkout so it goes when the checkout does.
if (devData)
  app.setPath("userData", path.join(app.getAppPath(), ".scratch/user-data"));

// One process owns the files in the user data folder, so writes serialised in memory can't interleave.
if (!app.requestSingleInstanceLock()) app.exit();

let closeSessions: (() => Promise<void>) | undefined;
let closing: Promise<void> | undefined;
// exitUnloaded also sets closing, but keeps the app shown for its error dialog.
let hiddenForQuit = false;
let relaunching = false;
// The quitting process holds the lock until it exits, so a launch during the quit relaunches the app then. app.relaunch starts one app per call.
const relaunchAfterQuit = () => {
  if (relaunching) return;
  relaunching = true;
  app.relaunch();
};

app.on("second-instance", () => {
  if (closing) return relaunchAfterQuit();
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return createWindow();
  if (window.isMinimized()) window.restore();
  window.focus();
});

// Quitting waits for each CLI to exit, so its session-end hooks, such as the transcript upload, finish. The app and its windows hide meanwhile, so the quit looks done.
app.on("before-quit", (event) => {
  if (!closeSessions) return;
  event.preventDefault();
  if (closing) return;
  hiddenForQuit = true;
  // On macOS hiding a fullscreen window itself leaves its Space black.
  if (process.platform === "darwin") app.hide();
  else for (const window of BrowserWindow.getAllWindows()) window.hide();
  // app.quit's teardown can outlast a child process still running, such as a starting session's version check, keeping the hidden app and its lock.
  closing = closeSessions().finally(() => app.exit(0));
});

// macOS shows a hidden app again when it becomes active, such as through Cmd+Tab.
app.on("did-become-active", () => {
  if (hiddenForQuit) app.hide();
});

void app.whenReady().then(() => {
  if (headless) app.dock?.hide();
  protocol.handle("app", serveRenderer);
  const userData = app.getPath("userData");
  const configDir = devData
    ? devClaudeConfigDir(app.getPath("appData"))
    : path.join(userData, "claude");
  closeSessions = registerIpc({
    findClaude: () =>
      R.map(
        findClaudeExecutable({ env: process.env, packaged: app.isPackaged }),
        (executable) => {
          const cli = { executable, configDir };
          return { cli, backend: createClaudeBackend(cli) };
        },
      ),
    conversations: new ConversationStore(
      path.join(userData, "conversations.json"),
    ),
    rendererUrl,
    openingWaitMs,
  });
  createWindow();
  app.on("activate", () => {
    if (closing) relaunchAfterQuit();
    else if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

import { app, BrowserWindow, dialog, net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { R } from "../../../../common/src/result";
import { createClaudeBackend } from "./agent/claude/backend";
import { findClaudeExecutable } from "./claude-executable";
import { ConversationStore } from "./conversations";
import { devClaudeConfigDir } from "./dev-app-data";
import { registerIpc } from "./ipc";

const rendererDir = path.join(import.meta.dirname, "../renderer");
// Set by the e2e tests, so each test's app opens no window or dock icon on screen.
const headless = process.env.ALLIANCE_AGENT_HEADLESS === "1";
// Caps the quit's wait for sessions still starting, which a hung network folder can stall, and for each new session's first reply, without which its CLI keeps no transcript to resume. The quit hides the app first, so an endless wait would leave an invisible app holding the lock. The e2e tests shorten it.
const openingWaitMs = z.coerce
  .number()
  .int()
  .positive()
  .default(30_000)
  .parse(process.env.ALLIANCE_AGENT_OPENING_WAIT_MS);
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

// A close in fullscreen hides the window once it leaves fullscreen, unless it is revealed first.
let hideOnLeavingFullScreen = false;

function reveal(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) throw new Error("Alliance agent has no window to show");
  hideOnLeavingFullScreen = false;
  if (window.webContents.isCrashed()) window.webContents.reload();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
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
  if (!headless) window.once("ready-to-show", () => window.show());
  // On macOS the app and its sessions outlive a closed window, so it hides to keep the renderer's conversations and unsent messages.
  if (process.platform === "darwin") {
    window.on("close", (event) => {
      event.preventDefault();
      // Hiding a fullscreen window leaves its Space behind as a black screen.
      if (!window.isFullScreen()) return window.hide();
      hideOnLeavingFullScreen = true;
      window.setFullScreen(false);
    });
    window.on("leave-full-screen", () => {
      if (!hideOnLeavingFullScreen) return;
      hideOnLeavingFullScreen = false;
      window.hide();
    });
  }
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
let relaunching = false;
// The quitting process holds the lock until it exits, so a launch during the quit relaunches the app then. app.relaunch starts one app per call.
const relaunchAfterQuit = () => {
  if (relaunching) return;
  relaunching = true;
  app.relaunch();
};

const reopen = () => (closing ? relaunchAfterQuit() : reveal());

app.on("second-instance", reopen);

// Quitting waits for each CLI to exit, so its session-end hooks, such as the transcript upload, finish. The app and its windows hide meanwhile, so the quit looks done and nothing starts another session.
app.on("before-quit", (event) => {
  if (!closeSessions) return;
  event.preventDefault();
  if (closing) return;
  // On macOS the app's hide takes a fullscreen window's Space with it, where hiding the window leaves the Space black.
  if (process.platform === "darwin") app.hide();
  else for (const window of BrowserWindow.getAllWindows()) window.hide();
  // app.quit's teardown can outlast a child process still running, such as a starting session's version check, keeping the hidden app and its lock.
  closing = closeSessions().finally(() => app.exit(0));
});

// macOS shows a hidden app again when it becomes active, such as through Cmd+Tab.
app.on("did-become-active", () => {
  if (closing) app.hide();
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
  app.on("activate", reopen);
});

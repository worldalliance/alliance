import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  net,
  protocol,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { R } from "../../../../common/src/result";
import { AgentKind } from "../shared/agent-kind";
import { repositoryFolder } from "../shared/repository";
import { isSignedInToClaude, signInToClaude } from "./agent/claude/auth";
import { createClaudeBackend } from "./agent/claude/backend";
import { isSignedInToCodex, signInToCodex } from "./agent/codex/auth";
import { createCodexBackend } from "./agent/codex/backend";
import { findExecutable } from "./cli-executable";
import { ConversationStore } from "./conversations";
import { describeError } from "./describe-error";
import { devClaudeConfigDir, devCodexHome } from "./dev-app-data";
import { gitEnvironment } from "./git-environment";
import { type Agent, registerIpc } from "./ipc";
import { findOnPath } from "./path-search";
import { findGit } from "./repository/git";
import { registerRepositoryIpc } from "./repository/ipc";
import { SavedRepository } from "./repository/saved";
import { RepositoryService } from "./repository/service";
import {
  allianceSource,
  testSource,
  testSourceVariable,
} from "./repository/source";
import { registerWorktreeIpc } from "./worktrees/ipc";
import { WorktreeService } from "./worktrees/service";
import { WorktreeStore } from "./worktrees/store";

const rendererDir = path.join(import.meta.dirname, "../renderer");
// Set by the e2e tests, so each test's app opens no window or dock icon on screen.
const headless = process.env.ALLIANCE_AGENT_HEADLESS === "1";
// Caps the quit's wait for sessions still starting, which a hung network folder can stall, and for each new session's CLI to read its first message, before which it keeps no transcript to resume. The quit hides the app first, so an endless wait would leave an invisible app holding the lock. The e2e tests shorten it.
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

const testSourceJson = app.isPackaged
  ? undefined
  : process.env[testSourceVariable];
const repositorySource = testSourceJson
  ? testSource.parse(JSON.parse(testSourceJson))
  : allianceSource(app.getPath("home"));

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

let hideOnLeavingFullScreen = false;
// Showing the window before its page paints flashes an empty frame; ready-to-show, or a crashed page's reload, shows it then.
let painted = false;
// A reveal asked for before the page paints. A crashed page's reload carries it out unless the window closes or the app quits first; ready-to-show shows the first paint regardless.
let revealOnLoad = false;

function reveal(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) throw new Error("Alliance agent has no window to show");
  hideOnLeavingFullScreen = false;
  if (window.webContents.isCrashed()) {
    painted = false;
    window.webContents.once("did-finish-load", () => {
      painted = true;
      if (revealOnLoad && !closing) reveal();
    });
    window.webContents.reload();
  }
  revealOnLoad = !painted;
  if (!painted) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

// styles.css's --background, which shows while the window resizes or its page reloads.
const windowBackground = () =>
  nativeTheme.shouldUseDarkColors ? "#0d1117" : "#ffffff";

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/index.cjs"),
    },
  });
  window.once("ready-to-show", () => {
    painted = true;
    if (!headless && !hiddenForQuit) window.show();
  });
  // On macOS the app and its sessions outlive a closed window, so it hides to keep the renderer's conversations and unsent messages.
  if (process.platform === "darwin") {
    window.on("close", (event) => {
      event.preventDefault();
      revealOnLoad = false;
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

const reopen = () => (closing ? relaunchAfterQuit() : reveal());

app.on("second-instance", reopen);

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
  const appData = app.getPath("appData");
  const agents: Record<AgentKind, (executable: string) => Agent> = {
    [AgentKind.Claude]: (executable) => {
      const cli = {
        executable,
        configDir: devData
          ? devClaudeConfigDir(appData)
          : path.join(userData, "claude"),
      };
      return {
        backend: createClaudeBackend(cli),
        isSignedIn: (signal) => isSignedInToClaude(cli, signal),
        signIn: (signal) => signInToClaude(cli, signal),
      };
    },
    [AgentKind.Codex]: (executable) => {
      const cli = {
        executable,
        home: devData ? devCodexHome(appData) : path.join(userData, "codex"),
      };
      return {
        backend: createCodexBackend(cli),
        isSignedIn: (signal) => isSignedInToCodex(cli, signal),
        signIn: (signal) => signInToCodex(cli, signal),
      };
    },
  };
  const repository = new RepositoryService({
    source: repositorySource,
    saved: new SavedRepository(path.join(userData, "repository.json")),
    ownCheckout:
      app.isPackaged || testSourceJson ? undefined : app.getAppPath(),
    findGit: () => findGit({ env: process.env, platform: process.platform }),
  });
  registerRepositoryIpc({ repository, rendererUrl });
  void repository.locate({ autoClone: true });
  const sessions = registerIpc({
    findAgent: (agent) =>
      R.map(
        findExecutable({ agent, env: process.env, packaged: app.isPackaged }),
        agents[agent],
      ),
    conversations: new ConversationStore(
      path.join(userData, "conversations.json"),
    ),
    rendererUrl,
    openingWaitMs,
    isArchived: (folder) => worktrees.isArchived(folder),
  });
  const worktrees = new WorktreeService({
    checkout: () => repositoryFolder(repository.current()),
    repositoryUrl: repositorySource.url,
    findGit: () => findGit({ env: process.env, platform: process.platform }),
    findBun: () => {
      const executable = findOnPath("bun", process.env);
      return executable
        ? R.success({ executable, env: gitEnvironment() })
        : R.failure(
            new Error(
              "Alliance agent needs Bun to list and create worktrees. Install it, then try again.",
            ),
          );
    },
    store: new WorktreeStore(path.join(userData, "worktrees.json")),
    closeSessionsIn: sessions.closeSessionsIn,
  });
  registerWorktreeIpc({ worktrees, rendererUrl });
  let listedFolder: string | undefined;
  const listIfMoved = () => {
    const folder = repositoryFolder(repository.current());
    if (folder === listedFolder) return;
    listedFolder = folder;
    void worktrees.refresh();
  };
  repository.subscribe(listIfMoved);
  listIfMoved();
  // Worktrees made in a terminal show up when the user comes back to the app.
  app.on("browser-window-focus", () => void worktrees.refresh());
  closeSessions = () =>
    Promise.all([worktrees.close(), sessions.close(), repository.close()]).then(
      () => undefined,
    );
  nativeTheme.on("updated", () => {
    for (const window of BrowserWindow.getAllWindows())
      window.setBackgroundColor(windowBackground());
  });
  createWindow();
  app.on("activate", reopen);
});

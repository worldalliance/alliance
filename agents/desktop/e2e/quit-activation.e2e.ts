import { _electron as electron, expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { appArgs } from "./app-args";
import { crashRenderer } from "./crash-renderer";
import { heldPage } from "./held-page";
import { start } from "./ipc-helpers";
import {
  captured,
  launch,
  processLines,
  runningCount,
  trackedClaude,
} from "./launch";

test("clicking the dock icon while the app quits reopens it once", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude: trackedClaude(),
  });
  await start(page);
  const closed = app.waitForEvent("close");
  const relaunches = await app.evaluate(({ app }) => {
    let calls = 0;
    Object.assign(app, { relaunch: () => (calls += 1) });
    app.quit();
    app.emit("activate");
    app.emit("activate");
    return calls;
  });
  expect(relaunches).toBe(1);
  await closed;
});

test("the quit hides the app, and hides it again when it becomes active", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude: trackedClaude(),
  });
  await start(page);
  const closed = app.waitForEvent("close");
  const hides = await app.evaluate(({ app, BrowserWindow }) => {
    const calls = { app: 0, window: 0 };
    Object.assign(app, { hide: () => (calls.app += 1) });
    for (const window of BrowserWindow.getAllWindows())
      Object.assign(window, { hide: () => (calls.window += 1) });
    const activate = () => {
      if (process.platform === "darwin") app.emit("did-become-active");
    };
    activate();
    const before = { ...calls };
    app.quit();
    activate();
    return [before, calls];
  });
  expect(hides).toEqual([
    { app: 0, window: 0 },
    process.platform === "darwin"
      ? { app: 2, window: 0 }
      : { app: 0, window: 1 },
  ]);
  await closed;
});

test("a window still loading when the quit begins stays hidden once it paints", async () => {
  const page = await heldPage();
  // Only a run that isn't headless shows the window on ready-to-show; the stubs keep it off screen, though macOS shows the dock icon.
  const app = await electron.launch({
    args: appArgs(),
    env: {
      ...process.env,
      ALLIANCE_AGENT_HEADLESS: "0",
      ELECTRON_RENDERER_URL: page.url,
    },
  });
  try {
    await page.requested;
    await app.evaluate(({ app, BrowserWindow, ipcMain }) => {
      const [window] = BrowserWindow.getAllWindows();
      if (!window) throw new Error("the app has no window");
      const calls: string[] = [];
      Object.assign(globalThis, { paintCalls: calls });
      Object.assign(window, {
        show: () => calls.push("show"),
        hide: () => undefined,
      });
      const exit = app.exit.bind(app);
      const checked = new Promise((resolve) =>
        ipcMain.once("checked", resolve),
      );
      Object.assign(app, {
        hide: () => undefined,
        exit: (code?: number) => void checked.then(() => exit(code)),
      });
      window.once("ready-to-show", () => calls.push("painted"));
      app.quit();
    });
    page.release();
    const calls = () =>
      app.evaluate(() => Reflect.get(globalThis, "paintCalls"));
    await expect.poll(calls).toContain("painted");
    expect(await calls()).toEqual(["painted"]);
  } finally {
    page.close();
    const closed = app.waitForEvent("close");
    // A setup that failed before the test's own quit leaves the app to quit here.
    await app.evaluate(({ app, ipcMain }) => {
      ipcMain.emit("checked");
      app.quit();
    });
    await closed;
  }
});

test("a window that fails to load leaves the app shown for its error when it becomes active", async () => {
  const { app } = await launch({ captures: [] });
  const exited = once(app.process(), "exit");
  const hides = await app.evaluate(async ({ app, BrowserWindow }) => {
    let hides = 0;
    Object.assign(app, { hide: () => (hides += 1) });
    const exit = app.exit.bind(app);
    const exiting = new Promise<number | undefined>((resolve) =>
      Object.assign(app, { exit: resolve }),
    );
    void BrowserWindow.getAllWindows()[0]
      ?.loadURL("app://renderer/missing.html")
      .catch(() => undefined);
    const code = await exiting;
    app.emit("did-become-active");
    setTimeout(() => exit(code));
    return hides;
  });
  expect(hides).toBe(0);
  const [code] = await exited;
  expect(code).toBe(1);
});

test("opening the app while it quits reopens it once the quit finishes", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  const closed = app.waitForEvent("close");
  // The quit would otherwise end before a slow second start reaches it.
  await app.evaluate(({ app }) => {
    const exit = app.exit.bind(app);
    const reached = new Promise((resolve) =>
      app.once("second-instance", resolve),
    );
    Object.assign(app, {
      exit: (code?: number) => void reached.then(() => exit(code)),
    });
    app.quit();
  });
  const userData = test.info().outputPath("user-data");
  const mainProcesses = () =>
    processLines("pid=,command=")
      .filter((line) => line.includes(userData) && !line.includes("--type="))
      .map((line) => Number.parseInt(line.trim(), 10));
  const electronPath = String(createRequire(import.meta.url)("electron"));
  try {
    const second = spawn(electronPath, appArgs(), {
      stdio: "ignore",
      timeout: 10_000,
    });
    const [code] = await once(second, "exit");
    expect(code).toBe(0);
    await closed;
    await expect.poll(mainProcesses).toHaveLength(1);
  } finally {
    for (const pid of mainProcesses()) process.kill(pid);
  }
  await expect.poll(() => runningCount(claude)).toBe(0);
});

test("a crashed window that finishes reloading while the app quits stays hidden", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude: trackedClaude(),
  });
  await start(page);
  const closed = app.waitForEvent("close");
  await crashRenderer(app);
  const calls = await app.evaluate(async ({ app, BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) throw new Error("no window");
    const calls: string[] = [];
    Object.assign(window, {
      show: () => calls.push("show"),
      focus: () => calls.push("focus"),
    });
    Object.assign(app, { hide: () => calls.push("hide") });
    const loaded = new Promise<void>((resolve) =>
      window.webContents.once("did-finish-load", () => resolve()),
    );
    // The quit would otherwise end before a slow reload finishes, and its exit would cut this evaluate short.
    const exit = app.exit.bind(app);
    const released = new Promise<void>((resolve) =>
      Object.assign(globalThis, { releaseExit: resolve }),
    );
    Object.assign(app, {
      exit: (code?: number) => void released.then(() => exit(code)),
    });
    app.emit("activate");
    app.quit();
    await loaded;
    return calls;
  });
  expect(calls).toEqual(process.platform === "darwin" ? ["hide"] : []);
  await app.evaluate(() => {
    const release: unknown = Reflect.get(globalThis, "releaseExit");
    if (typeof release !== "function") throw new Error("no exit to release");
    release();
  });
  await closed;
});

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { appArgs } from "./app-args";
import { start } from "./ipc-helpers";
import {
  captured,
  launch,
  outlivedApp,
  runningCount,
  trackedClaude,
} from "./launch";

const electronPath: string = createRequire(import.meta.url)("electron");

test("a window that fails to load reports the error and exits", async () => {
  const child = spawn(electronPath, appArgs(), {
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: "file:///nonexistent/index.html",
    },
    timeout: 10_000,
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const [code] = await once(child, "exit");
  expect(code).toBe(1);
  expect(stderr).toContain("Alliance agent couldn't load its window");
});

test("a window that fails to load closes every conversation's CLI before the app exits", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  const exited = once(app.process(), "exit");
  await app.evaluate(
    ({ BrowserWindow }) =>
      void BrowserWindow.getAllWindows()[0]
        ?.loadURL("app://renderer/missing.html")
        .catch(() => undefined),
  );
  const [code] = await exited;
  expect(code).toBe(1);
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
});

async function failPreload(
  source: string,
): Promise<{ code: number | null; stderr: string }> {
  const preload = test.info().outputPath("failing-preload.js");
  writeFileSync(preload, source);
  const app = await electron.launch({ args: appArgs() });
  const child = app.process();
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk));
  const exited = once(child, "close");
  try {
    // The app is ready once its window exists. The reload waits a task so evaluate replies before the failing preload exits the app.
    await app.firstWindow();
    await app.evaluate(({ BrowserWindow, session }, filePath) => {
      session.defaultSession.registerPreloadScript({ type: "frame", filePath });
      setTimeout(() => BrowserWindow.getAllWindows()[0]?.webContents.reload());
    }, preload);
    const [code] = await exited;
    return { code, stderr };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }
}

test("a preload script that fails reports what it threw and exits", async () => {
  const { code, stderr } = await failPreload('throw "preload failed";');
  expect(code).toBe(1);
  expect(stderr).toContain(
    "Alliance agent couldn't load its window: preload failed",
  );
  expect(stderr).not.toMatch(/^preload failed$/m);
});

test("a preload script that throws an error reports where it threw", async () => {
  const { stderr } = await failPreload(
    'function inner() { throw new Error("preload failed"); }\ninner();',
  );
  expect(stderr).toContain("failing-preload.js:1:");
});

// The first /slow.js response is held, so the replacement lands after the page commits.
async function expectLoadReplacedSurvives(
  replaceLoad: (app: ElectronApplication, url: string) => Promise<void>,
): Promise<void> {
  const slowRequest = Promise.withResolvers<void>();
  let scriptRequests = 0;
  const server = createServer((request, response) => {
    if (request.url !== "/slow.js") {
      response.end(
        '<title>Alliance agent</title><script src="/slow.js"></script>',
      );
      return;
    }
    const delay = scriptRequests++ === 0 ? 3000 : 0;
    if (delay) slowRequest.resolve();
    setTimeout(() => response.end(), delay);
  });
  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("no address");
  const url = `http://localhost:${address.port}/`;
  const app = await electron.launch({
    args: appArgs(),
    env: { ...process.env, ELECTRON_RENDERER_URL: url },
  });
  const loadError = new Promise<never>((_resolve, reject) =>
    app.process().stderr?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("couldn't load")) {
        reject(new Error(chunk.toString()));
      }
    }),
  );
  try {
    await slowRequest.promise;
    await replaceLoad(app, url);
    const page = await Promise.race([app.firstWindow(), loadError]);
    await Promise.race([expect(page).toHaveTitle("Alliance agent"), loadError]);
    await Promise.race([page.waitForLoadState("load"), loadError]);
  } finally {
    const exited = once(app.process(), "exit");
    app.process().kill("SIGKILL");
    await exited;
    server.closeAllConnections();
    server.close();
  }
}

test("a navigation during the first load leaves the window open", async () => {
  await expectLoadReplacedSurvives((app, url) =>
    app.evaluate(
      ({ BrowserWindow }, url) =>
        void BrowserWindow.getAllWindows()[0]?.loadURL(url),
      url,
    ),
  );
});

test("a reload during the first load leaves the window open", async () => {
  await expectLoadReplacedSurvives((app) =>
    app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.reload(),
    ),
  );
});

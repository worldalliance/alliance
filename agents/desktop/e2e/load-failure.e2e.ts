import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { appArgs } from "./app-args";

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

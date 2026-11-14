import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { appArgs } from "./app-args";
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

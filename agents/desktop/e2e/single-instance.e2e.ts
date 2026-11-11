import { _electron as electron, expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { appArgs } from "./app-args";

const electronPath = String(createRequire(import.meta.url)("electron"));

// The timeout ends a second app that a broken lock leaves running.
async function openAgain(): Promise<number | null> {
  const second = spawn(electronPath, appArgs(), {
    stdio: "ignore",
    timeout: 10_000,
  });
  const [code] = await once(second, "exit");
  return code;
}

test("opening the app again restores and focuses the running app's window", async () => {
  const app = await electron.launch({ args: appArgs() });
  await app.firstWindow();
  // A headless window is never shown, so it can't really be minimized or take focus.
  await app.evaluate(({ BrowserWindow }) => {
    const calls: string[] = [];
    Object.assign(globalThis, { windowCalls: calls });
    const [window] = BrowserWindow.getAllWindows();
    if (!window) throw new Error("the app has no window");
    Object.assign(window, {
      isMinimized: () => true,
      restore: () => calls.push("restore"),
      focus: () => calls.push("focus"),
    });
  });
  expect(await openAgain()).toBe(0);
  await expect
    .poll(() => app.evaluate(() => Reflect.get(globalThis, "windowCalls")))
    .toEqual(["restore", "focus"]);
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  await app.close();
});

test("opening the app again with no window open opens one", async () => {
  const app = await electron.launch({ args: appArgs() });
  await app.firstWindow();
  const windowCount = () =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  // Off macOS the app quits when its last window closes.
  await app.evaluate(({ app, BrowserWindow }) => {
    app.removeAllListeners("window-all-closed");
    app.on("window-all-closed", () => undefined);
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await expect.poll(windowCount).toBe(0);
  expect(await openAgain()).toBe(0);
  await expect.poll(windowCount).toBe(1);
  await app.close();
});

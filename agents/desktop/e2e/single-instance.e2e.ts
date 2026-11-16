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
  // Minimizing, showing and focus are stubbed, so the headless window stays off screen, and it can paint late, so it is marked painted.
  await app.evaluate(({ BrowserWindow }) => {
    const calls: string[] = [];
    Object.assign(globalThis, { windowCalls: calls });
    const [window] = BrowserWindow.getAllWindows();
    if (!window) throw new Error("the app has no window");
    window.emit("ready-to-show");
    Object.assign(window, {
      isMinimized: () => true,
      restore: () => calls.push("restore"),
      show: () => calls.push("show"),
      focus: () => calls.push("focus"),
    });
  });
  expect(await openAgain()).toBe(0);
  await expect
    .poll(() => app.evaluate(() => Reflect.get(globalThis, "windowCalls")))
    .toEqual(["restore", "show", "focus"]);
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  await app.close();
});

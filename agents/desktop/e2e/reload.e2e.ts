import { expect, test } from "@playwright/test";
import { IpcChannel } from "../src/shared/ipc";
import {
  askWithoutTask,
  finishFirstTurn,
  heldClaude,
  send,
  status,
} from "./chat-helpers";
import { authStatusCapture, captured, launch } from "./launch";

test("a reply still running when the window reloads shows as working and stops", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(page);
  await send(page, "Count to 100, one number per line");
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Change hello/ })
    .click();
  await expect(status(page)).toHaveText("Claude is working…");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(status(page)).toHaveText("Stopped.");
  await app.close();
});

test("each conversation keeps its unsent message when the window reloads or the app relaunches", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(page);
  await expect
    .poll(() => page.evaluate("localStorage.getItem('drafts')"))
    .toBe("{}");
  const box = page.getByLabel("Message Claude");
  const sidebar = page.getByRole("navigation");
  await box.fill("Half a message to the conversation");
  await sidebar.getByRole("button", { name: "Ask without a task" }).click();
  await box.fill("Half a first message");
  await page.reload();
  await sidebar.getByRole("button", { name: "Ask without a task" }).click();
  await expect(box).toHaveValue("Half a first message");
  await sidebar.getByRole("button", { name: /Change hello/ }).click();
  await expect(box).toHaveValue("Half a message to the conversation");
  await box.fill("Half a message, typed right before quitting");
  await app.close();

  const relaunched = await launch({
    captures: [authStatusCapture(true), captured("resume-with-image-session")],
  });
  const relaunchedBox = relaunched.page.getByLabel("Message Claude");
  await relaunched.page
    .getByRole("navigation")
    .getByRole("button", { name: "Ask without a task" })
    .click();
  await expect(relaunchedBox).toHaveValue("Half a first message");
  await relaunched.page
    .getByRole("navigation")
    .getByRole("button", { name: /Change hello/ })
    .click();
  await expect(relaunchedBox).toHaveValue(
    "Half a message, typed right before quitting",
  );
  await relaunched.app.close();
});

test("a conversation still starting when the window reloads shows in the sidebar", async () => {
  const { claude, release } = heldClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
  });
  await askWithoutTask(page);
  await send(page, "Change hello to goodbye in a.txt");
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("navigation").getByText("No conversations yet."),
  ).toBeVisible();
  release();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Change hello/ })
    .click();
  await expect(status(page)).toHaveText("Claude finished.");
  await app.close();
});

test("a failed read for a conversation still starting at the reload says so in the sidebar, again on a failed Try again, and Try again lists it", async () => {
  const { claude, release } = heldClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
  });
  await askWithoutTask(page);
  await send(page, "Change hello to goodbye in a.txt");
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await page.reload();
  const sidebar = page.getByRole("navigation");
  await expect(sidebar.getByText("No conversations yet.")).toBeVisible();
  await app.evaluate(({ ipcMain }, channel) => {
    // Electron keeps no public way to read a handler back, and the test restores this one.
    const handlers: unknown = Reflect.get(ipcMain, "_invokeHandlers");
    if (!(handlers instanceof Map)) throw new Error("no invoke handlers");
    Object.assign(globalThis, { listHandler: handlers.get(channel) });
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, () => ({ ok: false, error: "unreadable" }));
  }, IpcChannel.ListConversations);
  release();
  await expect(sidebar.getByRole("alert")).toHaveText(
    "Alliance agent couldn't read your saved conversations: unreadable",
  );
  await expect(sidebar.getByText("No conversations yet.")).toHaveCount(0);
  await sidebar
    .getByRole("alert")
    .evaluate((alert) => alert.setAttribute("data-shown", ""));
  await sidebar.getByRole("button", { name: "Try again" }).click();
  // A new alert, so a screen reader announces the repeated failure.
  await expect(sidebar.locator("[role=alert]:not([data-shown])")).toHaveText(
    "Alliance agent couldn't read your saved conversations: unreadable",
  );
  await expect(
    sidebar.getByRole("button", { name: "Try again" }),
  ).toBeFocused();
  await app.evaluate(({ ipcMain }, channel) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, Reflect.get(globalThis, "listHandler"));
  }, IpcChannel.ListConversations);
  await sidebar.getByRole("button", { name: "Try again" }).click();
  await expect(
    sidebar.getByRole("button", { name: /Change hello/ }),
  ).toBeVisible();
  await expect(sidebar.getByRole("alert")).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: "Ask without a task" }),
  ).toBeFocused();
  await app.close();
});

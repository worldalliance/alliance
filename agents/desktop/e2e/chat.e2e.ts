import {
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { IpcChannel } from "../src/shared/ipc";
import { authStatusCapture, captured, launch, workFolder } from "./launch";

async function chooseFolder(app: ElectronApplication, folder: string) {
  await app.evaluate(({ dialog }, chosen) => {
    Object.assign(dialog, {
      showOpenDialog: () =>
        Promise.resolve({ canceled: false, filePaths: [chosen] }),
    });
  }, folder);
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message Claude").fill(text);
  await page.getByLabel("Message Claude").press("Enter");
}

const status = (page: Page) => page.getByRole("status");

async function finishFirstTurn(app: ElectronApplication, page: Page) {
  const folder = workFolder();
  await chooseFolder(app, folder);
  await page.getByRole("button", { name: "Choose folder…" }).click();
  await expect(page.getByText(folder)).toBeVisible();
  await send(page, "Change hello to goodbye in a.txt");
  await expect(status(page)).toHaveText("Claude finished.");
}

test("a conversation streams replies, shows tool calls, stops, and resumes after a relaunch", async () => {
  const first = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  const { page } = first;

  await expect(
    page.getByRole("heading", { name: "New conversation" }),
  ).toBeVisible();
  await finishFirstTurn(first.app, page);
  await expect(page.locator(".user")).toHaveText(
    "Change hello to goodbye in a.txt",
  );
  await expect(page.locator(".tool")).toHaveCount(2);
  await expect(page.locator(".tool").nth(1)).toContainText("Edit");
  await expect(page.locator(".tool").nth(1)).toContainText("Done");
  const marker = () =>
    page.evaluate(
      `getComputedStyle(document.querySelectorAll(".tool summary")[1], "::before").content`,
    );
  expect(await marker()).toMatch(/^"▸"/);
  await page.locator(".tool summary").nth(1).click();
  expect(await marker()).toMatch(/^"▾"/);
  await expect(page.locator(".assistant")).toHaveText(
    'I changed "hello" to "goodbye" in `.scratch/claude-capture/a.txt`.',
  );
  await expect(page.getByRole("navigation")).toContainText(
    "Change hello to goodbye in a.txt",
  );
  await expect(page).toHaveTitle(
    "Change hello to goodbye in a.txt – Alliance agent",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Change hello to goodbye in a.txt",
    }),
  ).toBeAttached();

  await page
    .getByLabel("Message Claude")
    .fill("Count to 100, one number per line");
  // Send turns into Stop under the pointer, so a double-click's second click lands on Stop.
  await page.getByRole("button", { name: "Send" }).dblclick();
  // The capture streams the start of the count, then waits for the stop.
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  await expect(status(page)).toHaveText("Claude is working…");
  await expect(page.getByText("You stopped this reply.")).toHaveCount(0);
  await page.getByLabel("Message Claude").fill("next");
  await page.getByLabel("Message Claude").press("Enter");
  await expect(page.getByRole("alert")).toHaveText(
    "Claude is still replying. Wait for it to finish, or stop it.",
  );
  // Stop turns into Send under the pointer, so a double-click's second click lands on Send.
  await page.getByRole("button", { name: "Stop" }).hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByText("You stopped this reply.")).toBeVisible();
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
  await expect(page.getByLabel("Message Claude")).toHaveValue("next");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(status(page)).toHaveText("Stopped.");
  await expect(page.getByRole("button", { name: "Send" })).toBeFocused();
  await expect(page.locator(".error")).toHaveCount(0);

  await page.getByLabel("Message Claude").fill("");
  await page.getByLabel("Message Claude").press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Type a message first.");

  await send(page, "Reply with pong");
  await expect(page.locator(".assistant").nth(2)).toHaveText("pong");
  await expect(status(page)).toHaveText("Claude finished.");
  await first.app.close();

  const second = await launch({
    captures: [authStatusCapture(true), captured("resume-with-image-session")],
  });
  await second.page
    .getByRole("button", { name: /Change hello to goodbye in a\.txt/ })
    .click();
  await expect(
    second.page.getByText("Earlier messages in this conversation"),
  ).toBeVisible();
  await send(second.page, "Reply with pong");
  await expect(second.page.locator(".assistant")).toHaveText("pong");
  await expect(status(second.page)).toHaveText("Claude finished.");
  await second.app.close();
});

test("holding Enter on Send or Stop doesn't press the button that replaces it", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  await page
    .getByLabel("Message Claude")
    .fill("Count to 100, one number per line");
  await page.getByRole("button", { name: "Send" }).focus();
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  await expect(status(page)).toHaveText("Claude is working…");
  await expect(page.getByRole("button", { name: "Stop" })).toBeFocused();
  await page.getByLabel("Message Claude").fill("Reply with pong");
  await page.getByRole("button", { name: "Stop" }).focus();
  await page.keyboard.down("Enter");
  await expect(status(page)).toHaveText("Stopped.");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  // Sending from the box is refused with an alert if the held Enter already sent.
  await page.getByLabel("Message Claude").press("Enter");
  await expect(page.locator(".assistant").nth(2)).toHaveText("pong");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await app.close();
});

test("a message sent while a reply stops says to wait for the stop", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  await send(page, "Count to 100, one number per line");
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  // Without its listener the stop never reaches the CLI, so the reply stays stopping.
  await app.evaluate(
    ({ ipcMain }, channel) => ipcMain.removeAllListeners(channel),
    IpcChannel.Interrupt,
  );
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Stopping…" })).toBeVisible();
  await page.getByLabel("Message Claude").fill("next");
  await page.getByLabel("Message Claude").press("Enter");
  await expect(page.getByRole("alert")).toHaveText(
    "Claude is stopping. Send your message once it has stopped.",
  );
  await app.close();
});

test("a reply still running when the window reloads shows as working and stops", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
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

test("holding Enter in the message box sends once, without an alert", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  await page
    .getByLabel("Message Claude")
    .fill("Count to 100, one number per line");
  await page.keyboard.down("Enter");
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Message Claude")).toHaveValue("");
  await app.close();
});

test("reopening a conversation started in this run after an error keeps its messages", async () => {
  const { app, page } = await launch({
    captures: [
      authStatusCapture(true),
      captured("edit-and-interrupt-session"),
      captured("resume-with-image-session"),
    ],
  });
  await finishFirstTurn(app, page);
  await send(page, "Count to 100, one number per line");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(status(page)).toHaveText("Stopped.");
  await send(page, "Reply with pong");
  await expect(status(page)).toHaveText("Claude finished.");
  // The capture ends after three turns, so the stub exits on a fourth.
  await send(page, "One more");
  const error = page.locator(".transcript .error");
  await expect(error.locator("p")).toHaveText(
    "Claude couldn't finish this reply. Reopen the conversation to continue.",
  );
  await expect(error.locator("pre")).toContainText("Claude Code exited");
  await page.getByRole("button", { name: "Reopen conversation" }).click();
  await expect(page.getByLabel("Message Claude")).toBeVisible();
  await expect(page.locator(".user")).toHaveCount(4);
  await expect(error.locator("p")).toHaveText(
    "Claude couldn't finish this reply.",
  );
  await expect(
    page.getByRole("button", { name: "Reopen conversation" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Earlier messages in this conversation"),
  ).toHaveCount(0);
  await app.close();
});

test("a message sent without a folder says to choose one", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await send(page, "Hello");
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a folder for Claude to work in first.",
  );
  await expect(page.getByLabel("Message Claude")).toHaveValue("Hello");
  await app.close();
});

function writeConversations(contents: string) {
  const userData = test.info().outputPath("user-data");
  mkdirSync(userData, { recursive: true });
  writeFileSync(path.join(userData, "conversations.json"), contents);
}

function saveConversation(folder: string) {
  writeConversations(
    JSON.stringify({
      version: 1,
      conversations: [
        {
          id: "saved",
          folder,
          title: "Saved",
          startedAt: "2026-11-10T12:00:00.000Z",
        },
      ],
    }),
  );
}

test("saved conversations that can't be read say so in the sidebar", async () => {
  writeConversations("{");
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await expect(page.getByRole("navigation").getByRole("alert")).toContainText(
    "Alliance agent couldn't read your saved conversations",
  );
  await app.close();
});

test("a start the app refuses says why and keeps the message and focus", async () => {
  saveConversation(test.info().outputPath("removed"));
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await page.getByLabel("Message Claude").fill("Hello");
  await page.getByRole("button", { name: "Send" }).press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    /^Alliance agent couldn't start the conversation: .* doesn't exist/,
  );
  await expect(page.getByLabel("Message Claude")).toHaveValue("Hello");
  await expect(page.getByLabel("Message Claude")).toBeEditable();
  await expect(page.getByRole("button", { name: "Send" })).toBeFocused();
  await app.close();
});

test("a 320 px wide window leaves the message box most of its width", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(320, 600),
  );
  await expect
    .poll(() => page.locator("html").evaluate((root) => root.clientWidth))
    .toBe(320);
  const box = await page.getByLabel("Message Claude").boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  await app.close();
});

test("saved conversations stay out of reach until Claude is signed in", async () => {
  saveConversation(workFolder());
  const { app, page } = await launch({ captures: [authStatusCapture(false)] });
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await app.close();
});

test("a conversation that fails to open keeps focus off the page", async () => {
  saveConversation(test.info().outputPath("removed"));
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  const saved = page.getByRole("button", { name: /^Saved/ });
  await saved.click();
  await expect(page.getByRole("alert")).toContainText("doesn't exist");
  await expect(saved).toBeFocused();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't exist");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
  await app.close();
});

// Delays every CLI run but the sign-in check, so the start stays visible.
function slowClaude(seconds: number): string {
  const claude = test.info().outputPath("claude");
  writeFileSync(
    claude,
    `#!/bin/sh\n[ "$1" = auth ] || sleep ${seconds}\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  chmodSync(claude, 0o755);
  return claude;
}

test("the message box is read-only while a conversation starts, then the chat's takes focus", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude: slowClaude(1),
  });
  await chooseFolder(app, workFolder());
  await page.getByRole("button", { name: "Choose folder…" }).click();
  await send(page, "Change hello to goodbye in a.txt");
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await expect(page.getByLabel("Message Claude")).not.toBeEditable();
  await expect(status(page)).toHaveText("Claude finished.");
  await expect(page.getByLabel("Message Claude")).toBeFocused();
  await expect(page.getByLabel("Message Claude")).toBeEditable();
  await app.close();
});

test("a start the user leaves and comes back to still shows as starting, in the folder it started in", async () => {
  saveConversation(test.info().outputPath("removed"));
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude: slowClaude(3),
  });
  const folder = workFolder();
  await chooseFolder(app, folder);
  await page.getByRole("button", { name: "Change folder…" }).click();
  await expect(page.getByText(folder)).toBeVisible();
  await send(page, "Change hello to goodbye in a.txt");
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await chooseFolder(app, test.info().outputPath("other"));
  await page
    .getByRole("button", { name: "Change folder…" })
    .click({ force: true });
  await expect(page.getByText(folder)).toBeVisible();
  const sidebar = page.getByRole("navigation");
  await sidebar.getByRole("button", { name: /^Saved/ }).click();
  await sidebar.getByRole("button", { name: "Start a conversation" }).click();
  await expect(page.getByRole("button", { name: "Starting…" })).toBeVisible();
  await expect(page.getByLabel("Message Claude")).not.toBeEditable();
  await expect(page.getByText(folder)).toBeVisible();
  await expect(status(page)).toHaveText("Claude finished.", {
    timeout: 10_000,
  });
  await expect(
    sidebar.getByRole("button", { name: /Change hello/ }),
  ).toHaveCount(1);
  await app.close();
});

test("a view opened from the sidebar leaves focus there", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  const sidebar = page.getByRole("navigation");
  const newConversation = sidebar.getByRole("button", {
    name: "Start a conversation",
  });
  await newConversation.click();
  await expect(
    page.getByRole("heading", { name: "New conversation" }),
  ).toBeVisible();
  await expect(newConversation).toBeFocused();
  const conversation = sidebar.getByRole("button", { name: /Change hello/ });
  await conversation.press("Enter");
  await expect(page.locator(".user")).toBeVisible();
  await expect(conversation).toBeFocused();
  await app.close();
});

test("each conversation keeps its unsent message while the user moves between them", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  const box = page.getByLabel("Message Claude");
  const sidebar = page.getByRole("navigation");
  await box.fill("Half a message to the conversation");
  await sidebar.getByRole("button", { name: "Start a conversation" }).click();
  await expect(box).toHaveValue("");
  await box.fill("Half a first message");
  await sidebar.getByRole("button", { name: /Change hello/ }).click();
  await expect(box).toHaveValue("Half a message to the conversation");
  await sidebar.getByRole("button", { name: "Start a conversation" }).click();
  await expect(box).toHaveValue("Half a first message");
  await app.close();
});

test("each conversation keeps its unsent message when the window reloads", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  const box = page.getByLabel("Message Claude");
  const sidebar = page.getByRole("navigation");
  await box.fill("Half a message to the conversation");
  await sidebar.getByRole("button", { name: "Start a conversation" }).click();
  await box.fill("Half a first message");
  await page.reload();
  await expect(box).toHaveValue("Half a first message");
  await sidebar.getByRole("button", { name: /Change hello/ }).click();
  await expect(box).toHaveValue("Half a message to the conversation");
  await app.close();
});

test("closing the window on macOS keeps its conversations and unsent messages", async () => {
  test.skip(process.platform !== "darwin", "only macOS keeps the app open");
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  await page.getByLabel("Message Claude").fill("Half a follow-up");
  // A headless window stays off screen, so hiding and showing it are only recorded.
  const reopened = await app.evaluate(({ app, BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) throw new Error("the app has no window");
    const calls: string[] = [];
    Object.assign(window, {
      hide: () => calls.push("hide"),
      show: () => calls.push("show"),
    });
    window.close();
    app.emit("activate");
    return { windows: BrowserWindow.getAllWindows().length, calls };
  });
  expect(reopened).toEqual({ windows: 1, calls: ["hide", "show"] });
  await expect(page.locator(".user")).toHaveCount(1);
  await expect(page.getByLabel("Message Claude")).toHaveValue(
    "Half a follow-up",
  );
  await app.close();
});

const distanceFromEnd = async (page: Page): Promise<number> =>
  Number(
    await page.evaluate(`(() => {
      const transcript = document.querySelector(".transcript");
      return transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
    })()`),
  );

// The scroll event is dispatched by hand: a hidden window can deliver it after the next step has run.
const scrollToTop = (page: Page) =>
  page.evaluate(`{
    const transcript = document.querySelector(".transcript");
    transcript.scrollTop = 0;
    transcript.dispatchEvent(new Event("scroll"));
  }`);

test("the transcript follows the end only while the reader is there", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(app, page);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 360),
  );
  await scrollToTop(page);
  await expect.poll(() => distanceFromEnd(page)).toBeGreaterThan(80);

  await send(page, "Count to 100, one number per line");
  await expect(page.locator(".assistant").nth(1)).toContainText("1\n2\n3");
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(2);

  await scrollToTop(page);
  await expect.poll(() => distanceFromEnd(page)).toBeGreaterThan(80);
  await page.getByRole("button", { name: "Stop" }).click();
  const jump = page.getByRole("button", { name: "Jump to latest" });
  await expect(jump).toBeVisible();
  expect(
    await page.evaluate(`document.querySelector(".transcript").scrollTop`),
  ).toBe(0);
  await jump.press("Enter");
  await expect(jump).toHaveCount(0);
  await expect(page.getByLabel("Message Claude")).toBeFocused();
  expect(await distanceFromEnd(page)).toBeLessThan(2);
  await app.close();
});

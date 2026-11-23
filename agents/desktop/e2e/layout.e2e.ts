import {
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import path from "node:path";
import { AgentEventKind } from "../src/shared/agent-event";
import { type AgentApi, IpcChannel } from "../src/shared/ipc";
import { finishFirstTurn, saveConversation } from "./chat-helpers";
import { authStatusCapture, captured, launch, workFolder } from "./launch";

declare const window: { agent: AgentApi };

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

test("a short window at 200% zoom keeps room to read the transcript", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(page);
  await app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    window?.setContentSize(640, 600);
    window?.webContents.setZoomFactor(2);
  });
  await expect
    .poll(() => page.locator("html").evaluate((root) => root.clientHeight))
    .toBe(300);
  const transcript = await page.locator(".transcript").boundingBox();
  expect(transcript?.height).toBeGreaterThanOrEqual(128);
  await expect(page.getByLabel("Message Claude")).toBeEditable();
  await app.close();
});

test("a long tool name wraps in a 320 px wide window, keeping its status in view", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(page);
  const listed = await page.evaluate(() => window.agent.listConversations());
  if (!listed.ok) throw new Error(listed.error);
  const name = "mcp__example__lookup_repository_information";
  await app.evaluate(
    ({ BrowserWindow }, { channel, payload }) => {
      const [window] = BrowserWindow.getAllWindows();
      window?.setContentSize(320, 600);
      window?.webContents.send(channel, payload);
    },
    {
      channel: IpcChannel.Event,
      payload: {
        sessionId: listed.value[0]?.id,
        event: {
          kind: AgentEventKind.ToolStarted,
          toolCallId: "long-name",
          name,
          input: {},
        },
      },
    },
  );
  await expect
    .poll(() => page.locator("html").evaluate((root) => root.clientWidth))
    .toBe(320);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.locator(".tool-status").last()).toBeInViewport();
  expect(
    await page
      .locator(".transcript")
      .evaluate(
        (transcript) => transcript.scrollWidth - transcript.clientWidth,
      ),
  ).toBe(0);
  await app.close();
});

async function expectAlertFits(page: Page, text: string) {
  const alert = page.getByRole("alert");
  await expect(alert).toContainText(text);
  expect(
    await alert.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        element.getBoundingClientRect().right <=
          element.ownerDocument.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function narrow(app: ElectronApplication, page: Page) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(320, 600),
  );
  await expect
    .poll(() => page.locator("html").evaluate((root) => root.clientWidth))
    .toBe(320);
}

const longMissingFolder = () => path.join(workFolder(), "a".repeat(120));

test("reopening a conversation whose long folder is gone wraps in a 320 px wide window", async () => {
  saveConversation(longMissingFolder());
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await narrow(app, page);
  await page.getByRole("button", { name: /Saved/ }).click();
  await expectAlertFits(page, "couldn't open this conversation");
  await app.close();
});

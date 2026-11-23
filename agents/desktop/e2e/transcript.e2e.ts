import { expect, type Page, test } from "@playwright/test";
import { rmSync } from "node:fs";
import { type AgentEvent, AgentEventKind } from "../src/shared/agent-event";
import { type AgentApi, IpcChannel } from "../src/shared/ipc";
import { finishFirstTurn, send } from "./chat-helpers";
import { authStatusCapture, captured, launch, workFolder } from "./launch";

declare const window: { agent: AgentApi };

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
  await finishFirstTurn(page);
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

test("Jump to latest moves focus to Try again while the conversation can't reopen", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await finishFirstTurn(page);
  const listed = await page.evaluate(() => window.agent.listConversations());
  if (!listed.ok) throw new Error(listed.error);
  const sessionId = listed.value[0]?.id;
  const emit = (event: AgentEvent) =>
    app.evaluate(
      ({ BrowserWindow }, { channel, payload }) =>
        BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload),
      { channel: IpcChannel.Event, payload: { sessionId, event } },
    );
  const lines: AgentEvent = {
    kind: AgentEventKind.AssistantText,
    text: "line\n".repeat(40),
  };
  await emit({
    kind: AgentEventKind.Error,
    message: "Claude Code exited",
    needsResume: true,
  });
  rmSync(workFolder(), { recursive: true });
  await page.getByRole("button", { name: "Reopen conversation" }).click();
  const tryAgain = page.getByRole("button", { name: "Try again" });
  await expect(tryAgain).toBeVisible();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 360),
  );
  await emit(lines);
  await scrollToTop(page);
  await expect.poll(() => distanceFromEnd(page)).toBeGreaterThan(80);
  await emit(lines);
  const jump = page.getByRole("button", { name: "Jump to latest" });
  await jump.press("Enter");
  await expect(jump).toHaveCount(0);
  await expect(tryAgain).toBeFocused();
  await app.close();
});

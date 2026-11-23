import { expect, type Page, test } from "@playwright/test";
import { status } from "./chat-helpers";

export const request = "Change hello to goodbye in a.txt";
export const taskFolder = () =>
  test.info().outputPath("alliance-change-hello-to-goodbye-in-a-txt");

export async function repositoryReady(page: Page) {
  await expect(
    page.getByRole("button", { name: /^Alliance repository/ }),
  ).toContainText("Ready");
}

// Creating a task, then its first turn, outlasts the default timeout on a loaded machine.
export const firstTurnDone = (page: Page) =>
  expect(status(page)).toHaveText("Claude finished.", { timeout: 15_000 });

export const taskEntry = (page: Page, title = request) =>
  page.getByRole("navigation").getByRole("button", { name: title }).first();

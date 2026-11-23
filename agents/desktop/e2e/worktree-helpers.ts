import { expect, type Page, test } from "@playwright/test";
import { send, status } from "./chat-helpers";

export const request = "Change hello to goodbye in a.txt";
export const worktreeName = "change-hello-to-goodbye-in-a-txt";
export const worktreeFolder = () =>
  test.info().outputPath("alliance-change-hello-to-goodbye-in-a-txt");

export async function repositoryReady(page: Page) {
  await expect(
    page.getByRole("button", { name: /^Alliance repository/ }),
  ).toContainText("Ready");
}

export const conversationsFile = () =>
  test.info().outputPath("user-data", "conversations.json");

export const worktreesFile = () =>
  test.info().outputPath("user-data", "worktrees.json");

export const archived = (page: Page) =>
  page.getByRole("navigation").getByText("Archived (1)");

export const firstTurnDone = (page: Page) =>
  expect(status(page)).toHaveText("Claude finished.");

export const worktreeEntry = (page: Page, name = worktreeName) =>
  page.getByRole("navigation").getByRole("button", { name }).first();

/** Fills in New worktree with name and creates it, leaving the window on the creation. */
export async function createWorktree(page: Page, name = request) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New worktree" })
    .click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create worktree" }).click();
}

export const newConversationHeading = (page: Page) =>
  page.getByRole("heading", { name: "New conversation in this worktree" });

// Creating a worktree outlasts the default timeout on a loaded machine.
export const worktreeReady = (page: Page) =>
  expect(newConversationHeading(page)).toBeVisible({ timeout: 15_000 });

/** Creates a worktree named after request, then sends request in it and waits for the turn to end. */
export async function startInNewWorktree(page: Page) {
  await createWorktree(page);
  await worktreeReady(page);
  await send(page, request);
  await firstTurnDone(page);
}

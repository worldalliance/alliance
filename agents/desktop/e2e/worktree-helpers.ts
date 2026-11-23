import { expect, type Page, test } from "@playwright/test";
import { status } from "./chat-helpers";

export const request = "Change hello to goodbye in a.txt";
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

// Creating a worktree, then its first turn, outlasts the default timeout on a loaded machine.
export const firstTurnDone = (page: Page) =>
  expect(status(page)).toHaveText("Claude finished.", { timeout: 15_000 });

export const worktreeEntry = (page: Page, title = request) =>
  page.getByRole("navigation").getByRole("button", { name: title }).first();
